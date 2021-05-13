const util = require('util');

const BinaryParser = require('../index.js');

function print(result)
{
	console.log(util.inspect(result, { depth: null, showHidden: false, compact: false }));
}



// simple numbers

const ImageHeaderSimple_Schema = {
	fields: [
		{ name: 'ImageType', type: 'number', byteLength: 1 },
		{ name: 'Width', type: 'unsigned', byteLength: 2 },
		{ name: 'Height', type: 'unsigned', byteLength: 2 }
	]
};

let imageHeaderSimple_RAW = Buffer.from('0164011202', 'hex');

let imageHeaderSimple_LE = BinaryParser.parse(ImageHeaderSimple_Schema, imageHeaderSimple_RAW, true);
let imageHeaderSimple_BE = BinaryParser.parse(ImageHeaderSimple_Schema, imageHeaderSimple_RAW);

print(imageHeaderSimple_LE); // -> { ImageType: 1, Width: 356, Height: 530 }
print(imageHeaderSimple_BE); // -> { ImageType: 1, Width: 25601, Height: 4610 }



// nested records

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



// class in prototype

class ImageMetrics
{
	constructor() {}

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


// arrays

const ImageHeaderList_Schema = {
	fields: [
		{ name: 'ItemCount', type: 'unsigned', byteLength: 1 },
		{
			name: 'Images',
			type: 'array',
			hasNextItem: (array, reader) => array.length < array.__parent.ItemCount,
			// arrays always consist of records (see decoders to get plain values)
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



// dynamic schema

const ArrayOfNumbers_Schema = {
	fields: [
		{ name: 'Count', type: 'unsigned', byteLength: 2 },
		{ name: 'DataSize', type: 'unsigned', byteLength: 1 },
		{ 
			name: 'Payload',
			type: 'array',
			hasNextItem: (array, reader) => array.length < array.__parent.Count,
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



// strings and buffers

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



// skip

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



// read all that is left

const DataWithHeader_Schema = {
	fields: [
		{ name: 'HeaderFlag', type: 'unsigned', byteLength: 1 },
		{ name: 'Payload', type: 'buffer', byteLength: (record, reader) => reader.leftBytes }
	]
};

let dataWithHeader_RAW = Buffer.from('a1006b7562610200ff01', 'hex');

let dataWithHeader = BinaryParser.parse(DataWithHeader_Schema, dataWithHeader_RAW, true);

print(dataWithHeader);



// decoders (single and record)

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




// array decoders

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




// field validator

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
	print(error instanceof BinaryParser.StreamContentError); // -> true
}




// array validator & decoder

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
	print(error instanceof BinaryParser.StreamContentError); // -> true
}



// custom iterators

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


