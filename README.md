# binary-parser
**Parse binary data according to provided declarative schema**

The idea behind the library is to provide the developer with a simple tool that allows them do describe the schema of expected output objects and then parse binary data (in NodeJS Buffer) according to the schema. Since the approach is (mostly) declarative - the underlying parsing and validation work is effectively hidden, while the developer gains the high-level view of how the data on the wire is being transformed into possibly nested structures of objects and arrays. The library has been successfully used in a few projects both for self-designed and 3rd party binary protocols.

## Warning

*This repository is a work in progress, published for demonstration purposes. Do not use.*

## How to use (by examples)

It is assumed that `BinaryParser` class was imported into the scope:

```javascript
const BinaryParser = require('./binary-parser');
```

Examples source is available in `examples/examples.js`.

### Parsing simple numbers

```javascript
const ImageHeaderSimple_Schema = {
	fields: [
		{ name: 'ImageType', type: 'number', byteLength: 1 },
		{ name: 'Width', type: 'unsigned', byteLength: 2 },
		{ name: 'Height', type: 'unsigned', byteLength: 2 }
	]
};

let imageHeaderSimple_RAW = Buffer.from('0164011202', 'hex');

let imageHeaderSimple_LE = BinaryParser.parse(ImageHeaderSimple_Schema, imageHeaderSimple_RAW, true); // <- "true" stands for Little-Endian
let imageHeaderSimple_BE = BinaryParser.parse(ImageHeaderSimple_Schema, imageHeaderSimple_RAW);

print(imageHeaderSimple_LE);
print(imageHeaderSimple_BE);
```

Expected result:

```javascript
{
  ImageType: 1,
  Width: 356,
  Height: 530
}
```
```javascript
{
  ImageType: 1,
  Width: 25601,
  Height: 4610
}
```

### Nested records of data

```javascript
const ImageHeaderNested_Schema = {
	fields: [
		{ name: 'ImageType', type: 'number', byteLength: 1 },
		{ 
			name: 'Size',
			type: 'record',
			schema: {
				fields: [
					{ name: 'Width', type: 'unsigned', byteLength: 2 },
					{ name: 'Height', type: 'unsigned', byteLength: 2 }
				]
			}
		},
	]
};

let imageHeaderNested_RAW = Buffer.from('0164011202', 'hex');

let imageHeaderNested = BinaryParser.parse(ImageHeaderNested_Schema, imageHeaderNested_RAW, true);

print(imageHeaderNested);
print(imageHeaderNested.Size.__parent === imageHeaderNested);
```

Expected result:

```javascript
{
  ImageType: 1,
  Size: {
    Width: 356,
    Height: 530
  }
}
```
```javascript
true
```

### Using class in prototype chain of parsed record

```javascript
class ImageMetrics
{
	get size()
	{
		return this.Width * this.Height;
	}
}

const ImageHeaderClass_Schema = {
	fields: [
		{ name: 'ImageType', type: 'number', byteLength: 1 },
		{ 
			name: 'Metrics',
			type: 'record',
			schema: {
			class: ImageMetrics,
				fields: [
					{ name: 'Width', type: 'unsigned', byteLength: 2 },
					{ name: 'Height', type: 'unsigned', byteLength: 2 }
				]
			}
		},
	]
};

let imageHeaderClass_RAW = Buffer.from('0164011202', 'hex');

let imageHeaderClass = BinaryParser.parse(ImageHeaderClass_Schema, imageHeaderClass_RAW, true);

print(imageHeaderClass.Metrics instanceof ImageMetrics);
print(imageHeaderClass.Metrics.size);
```

Expected result:

```javascript
true
```
```javascript
188680
```

### Parsing arrays

```javascript
const ImageHeaderList_Schema = {
	fields: [
		{ name: 'ItemCount', type: 'unsigned', byteLength: 1 },
		{
			name: 'Images',
			type: 'array',
			hasNextItem: (array, reader) => array.length < array.__parent.ItemCount,
			// arrays always consist of records
			schema: {
				fields: [
					{ name: 'ImageType', type: 'number', byteLength: 1 },
					{ name: 'Width', type: 'unsigned', byteLength: 2 },
					{ name: 'Height', type: 'unsigned', byteLength: 2 }					
				]
			}
		}
	]
};

let imageHeaderList_RAW = Buffer.from('03016401120202640112020364011202', 'hex');

let imageHeaderList = BinaryParser.parse(ImageHeaderList_Schema, imageHeaderList_RAW, true);

print(imageHeaderList);
```

Expected result:

```javascript
{
  ItemCount: 3,
  Images: [
    {
      ImageType: 1,
      Width: 356,
      Height: 530
    },
    {
      ImageType: 2,
      Width: 356,
      Height: 530
    },
    {
      ImageType: 3,
      Width: 356,
      Height: 530
    }
  ]
}
```

### Using dynamic schema

```javascript
const ArrayOfNumbers_Schema = {
	fields: [
		{ name: 'Count', type: 'unsigned', byteLength: 2 },
		{ name: 'DataSize', type: 'unsigned', byteLength: 1 },
		{ 
			name: 'Payload',
			type: 'array',
			hasNextItem: (array, reader) => array.length < array.__parent.Count,
			// arrays always consist of records (see decoders below on how to get plain values)
			schema: {
				fields: [
					{ name: 'Value', type: 'unsigned', byteLength: (record, reader) => record.__parent.__parent.DataSize }
				]
			}
		},
	]
};

let arrayOfNumbers_RAW_1 = Buffer.from('0500010102030405', 'hex');
let arrayOfNumbers_RAW_2 = Buffer.from('05000206000700080009000a00', 'hex');

let arrayOfNumbers_1 = BinaryParser.parse(ArrayOfNumbers_Schema, arrayOfNumbers_RAW_1, true);
let arrayOfNumbers_2 = BinaryParser.parse(ArrayOfNumbers_Schema, arrayOfNumbers_RAW_2, true);

print(arrayOfNumbers_1);
print(arrayOfNumbers_2);
```

Expected result:

```javascript
{
  Count: 5,
  DataSize: 1,
  Payload: [
    {
      Value: 1
    },
    {
      Value: 2
    },
    {
      Value: 3
    },
    {
      Value: 4
    },
    {
      Value: 5
    }
  ]
}
```
```javascript
{
  Count: 5,
  DataSize: 2,
  Payload: [
    {
      Value: 6
    },
    {
      Value: 7
    },
    {
      Value: 8
    },
    {
      Value: 9
    },
    {
      Value: 10
    }
  ]
}
```

### Parsing strings and raw buffers

```javascript
const NamesAndFlags_Schema = {
	fields: [
		{ name: 'NameLength', type: 'unsigned', byteLength: 2 },
		{ name: 'Name', type: 'string', encoding: 'utf8', byteLength: (record, reader) => record.NameLength },
		{ name: 'FlagsLength', type: 'unsigned', byteLength: 2 },
		{ name: 'Flags', type: 'buffer', byteLength: (record, reader) => record.FlagsLength }
	]
};

let namesAndFlags_RAW = Buffer.from('04006b7562610200ff01', 'hex');

let namesAndFlags = BinaryParser.parse(NamesAndFlags_Schema, namesAndFlags_RAW, true);

print(namesAndFlags);
```

Expected result:

```javascript
{
  NameLength: 4,
  Name: 'kuba',
  FlagsLength: 2,
  Flags: <Buffer ff 01>
}
```

### Ignoring parts of data and skipping fields

```javascript
const VariantFields_Schema = {
	fields: [
		{ name: 'HeaderFlag', type: 'unsigned', byteLength: 1 },
		{ name: '', type: 'buffer', byteLength: 8 }, // <- ignored
		{ name: 'DataLength', type: 'unsigned', byteLength: 2 },
		{ name: 'DataType', type: 'unsigned', byteLength: 1 },
		{ name: 'Name', type: 'string', encoding: 'utf8', byteLength: (record, reader) => record.DataLength, skip: (record, reader) => record.DataType !== 1 },
		{ name: 'Mail', type: 'string', encoding: 'utf8', byteLength: (record, reader) => record.DataLength, skip: (record, reader) => record.DataType !== 2 }
	]
};

let variantFields_RAW_1 = Buffer.from('0100000000000000000400016b756261', 'hex');
let variantFields_RAW_2 = Buffer.from('0100000000000000000600026140612e706c', 'hex');

let variantFields_1 = BinaryParser.parse(VariantFields_Schema, variantFields_RAW_1, true);
let variantFields_2 = BinaryParser.parse(VariantFields_Schema, variantFields_RAW_2, true);

print(variantFields_1);
print(variantFields_2);
```

Expected result:

```javascript
{
  HeaderFlag: 1,
  DataLength: 4,
  DataType: 1,
  Name: 'kuba'
}
```
```javascript
{
  HeaderFlag: 1,
  DataLength: 6,
  DataType: 2,
  Mail: 'a@a.pl'
}
```

### Read all up to the end of buffer

```javascript
const DataWithHeader_Schema = {
	fields: [
		{ name: 'HeaderFlag', type: 'unsigned', byteLength: 1 },
		{ name: 'Payload', type: 'buffer', byteLength: (record, reader) => reader.leftBytes }
	]
};

let dataWithHeader_RAW = Buffer.from('a1006b7562610200ff01', 'hex');

let dataWithHeader = BinaryParser.parse(DataWithHeader_Schema, dataWithHeader_RAW, true);

print(dataWithHeader);
```

Expected result:

```javascript
{
  HeaderFlag: 161,
  Payload: <Buffer 00 6b 75 62 61 02 00 ff 01>
}
```

### Using decoders (for particular fields and whole record)

```javascript
const DecodedHeader_Schema = {
	fields: [
		{ name: 'ImageType', type: 'number', byteLength: 1 },
		{ name: 'CreateDate', type: 'unsigned', byteLength: 8, decoder: (value) => new Date(value) },
		{ 
			name: 'Size',
			type: 'record',
			decoder: (value) => `${value.Width} x ${value.Height}`,
			schema: {
				fields: [
					{ name: 'Width', type: 'unsigned', byteLength: 2 },
					{ name: 'Height', type: 'unsigned', byteLength: 2 }
				]
			}
		},
	]
};

let decodedHeader_RAW = Buffer.from('010000017931CC53E801640212', 'hex');

let decodedHeader = BinaryParser.parse(DecodedHeader_Schema, decodedHeader_RAW, false);

print(decodedHeader);
```

Expected result:

```javascript
{
  ImageType: 1,
  CreateDate: 2021-05-03T10:35:45.000Z,
  Size: '356 x 530'
}
```

### Using decoders with arrays

```javascript
const DecodedArray_Schema = {
	fields: [
		{ name: 'Count', type: 'unsigned', byteLength: 2 },
		{ 
			name: 'Values',
			type: 'array',
			hasNextItem: (array, reader) => array.length < array.__parent.Count,
			// for arrays decoder is called per item, not for whole array
			decoder: (value) => value.Value,
			schema: {
				fields: [
					{ name: 'Value', type: 'unsigned', byteLength: 1 }
				]
			}
		},
	]
};

let decodedArray_RAW = Buffer.from('0500010102030405', 'hex');

let decodedArray = BinaryParser.parse(DecodedArray_Schema, decodedArray_RAW, true);

print(decodedArray);
```

Expected result:

```javascript
{
  Count: 5,
  Values: [
    1,
    1,
    2,
    3,
    4
  ]
}
```

### Using field validators

```javascript
const FieldValidating_Schema = {
	fields: [
		{ name: 'HeaderFlag', type: 'unsigned', byteLength: 1 },
		{ name: 'IMEI', type: 'string', byteLength: 15, validator: (value) => /^[0-9]{15}$/.test(value) },
		{ name: 'Payload', type: 'buffer', byteLength: (record, reader) => reader.leftBytes }
	]
};

let fieldValidating_RAW_1 = Buffer.from('01313233313539393837313539393837000102', 'hex');
let fieldValidating_RAW_2 = Buffer.from('01313233313567000037313539393837000102', 'hex');

let fieldValidating_1 = BinaryParser.parse(FieldValidating_Schema, fieldValidating_RAW_1, true);
print(fieldValidating_1);

try
{
	let fieldValidating_2 = BinaryParser.parse(FieldValidating_Schema, fieldValidating_RAW_2, true);
}
catch (error)
{
	print(error instanceof BinaryParser.StreamContentError);
}
```

Expected result:

```javascript
{
  HeaderFlag: 1,
  IMEI: '123159987159987',
  Payload: <Buffer 00 01 02>
}
```
```javascript
true
```

### Using validators and decoders with arrays

```javascript
const ArrayValidating_Schema = {
	fields: [
		{ name: 'Count', type: 'unsigned', byteLength: 2 },
		{ 
			name: 'Values',
			type: 'array',
			hasNextItem: (array, reader) => array.length < array.__parent.Count,
			// for arrays decoder and validator is called per item, not for whole array
			validator: (value) => value.__parent.length === 0 || value.__parent[value.__parent.length - 1] <= value.Value, // monotonic array expected
			decoder: (value) => value.Value,
			schema: {
				fields: [
					{ name: 'Value', type: 'unsigned', byteLength: 1 }
				]
			}
		},
	]
};

let arrayValidating_RAW_1 = Buffer.from('0500000102030405', 'hex');
let arrayValidating_RAW_2 = Buffer.from('0500000102010405', 'hex');

let arrayValidating_1 = BinaryParser.parse(ArrayValidating_Schema, arrayValidating_RAW_1, true);
print(arrayValidating_1);

try
{
	let arrayValidating_2 = BinaryParser.parse(ArrayValidating_Schema, arrayValidating_RAW_2, true);
}
catch (error)
{
	print(error instanceof BinaryParser.StreamContentError);
}
```

Expected result:

```javascript
{
  Count: 5,
  Values: [
    0,
    1,
    2,
    3,
    4
  ]
}
```
```javascript
true
```

### Excercising custom iterators

```javascript
const fieldIterator = function(record, reader, fields)
{
	while (reader.leftBytes > 0)
	{
		let _fieldCode = reader.readUInt8(); // <- note that reading advances by one byte
		let found = fields.find((field) => field._code === _fieldCode);
		if (found)
			return found; // process this field now
		else
			reader.skipBytes(1); // skip this item
	}
};

const CustomIterator_Schema = {
	fields: [
		{
			name: 'Entries',
			type: 'record',
			schema: {
				getNextField: fieldIterator,
				fields: [
					{ name: 'X', type: 'unsigned', byteLength: 1, _code: 1 },
					{ name: 'Y', type: 'unsigned', byteLength: 1, _code: 2 },
					{ name: 'Z', type: 'unsigned', byteLength: 1, _code: 3 },
					{ name: 'A', type: 'unsigned', byteLength: 1, _code: 4 },
					{ name: 'B', type: 'unsigned', byteLength: 1, _code: 5 },
					{ name: 'C', type: 'unsigned', byteLength: 1, _code: 6 },
				]
			}
		}
	]
};

let customIterator_RAW = Buffer.from('0213031407150610', 'hex');

let customIterator = BinaryParser.parse(CustomIterator_Schema, customIterator_RAW, true);
print(customIterator);
```

Expected result:

```javascript
{
  Entries: {
    Y: 19,
    Z: 20,
    C: 16
  }
}
```


