'use strict';

const BufferReader = require('./BufferReader.js');

const StreamContentError = require('./StreamContentError.js');
const SchemaError = require('./SchemaError.js');

const parsers = {
	'number': {
		'1': BufferReader.prototype.readInt8,
		'2': BufferReader.prototype.readInt16,
		'4': BufferReader.prototype.readInt32,
		'8': BufferReader.prototype.readInt64
	},
	'unsigned': {
		'1': BufferReader.prototype.readUInt8,
		'2': BufferReader.prototype.readUInt16,
		'4': BufferReader.prototype.readUInt32,
		'8': BufferReader.prototype.readInt64 /* ! */
	}
};

const dynamicProperties = [
	{ name: 'type', default: 'number' },
	{ name: 'byteLength', default: 1 },
	{ name: 'name', default: '' },
	{ name: 'encoding', default: 'utf8' }	
];

class BinaryParserImpl
{
	static bindValueAsFunction(target, name, def)
	{
		let value = target[name] || def;
		if (!target.hasOwnProperty('__' + name))
			Object.defineProperty(target, '__' + name, { value:
				typeof value === 'function'
				? value
				: () => value
			});
	}

	static instrumentSchemaField(field, ...args)
	{
		dynamicProperties.forEach(property => BinaryParserImpl.bindValueAsFunction(field, property.name, property.default));
		dynamicProperties.forEach(property => field[property.name] = field['__' + property.name](...args));

		if (typeof field.name !== 'string')
			throw new SchemaError('Please provide a valid field name or empty string to skip in output record.');
		if (field.type !== 'number' && field.type !== 'unsigned' && field.type !== 'array' && field.type !== 'record' && field.type !== 'string' && field.type !== 'buffer')
			throw new SchemaError('Unrecognized schema field type: ' + field.type);
		if (typeof field.byteLength !== 'number' || field.byteLength <= 0)
			throw new SchemaError('Data size for field must be greater than or equal to 1.');
		
		if (field.type === 'number' || field.type === 'unsigned') {
			if (typeof parsers[field.type][field.byteLength.toString()] !== 'undefined')
				field.parser = parsers[field.type][field.byteLength.toString()];
			else
				throw new SchemaError('For number/unsigned types only 1, 2, 4 or 8 wire size is allowed.');
		}
		else if (field.type === 'array') {
			if (typeof field.hasNextItem !== 'function')
				throw new SchemaError('For array one must specify the loop limiting function.');
		}
		else if (field.type === 'string') {
			let _byteLength = field.byteLength, _encoding = field.encoding;
			field.parser = function() { return BufferReader.prototype.readString.call(this, _byteLength, _encoding); }
		}
		else if (field.type === 'buffer') {
			let _byteLength = field.byteLength;
			field.parser = function() { return BufferReader.prototype.readBuffer.call(this, _byteLength); }
		}
		
		if (typeof field.decoder !== 'function')
			field.decoder = (_) => _;

		if (typeof field.wrappedValidator !== 'function')
		{
			if (typeof field.validator !== 'function')
				field.wrappedValidator = (_) => _;
			else
				field.wrappedValidator = ((fieldName, actualValidator, value) => {
					if (actualValidator(value))
						return value;
					else
						throw new StreamContentError(fieldName, value);
				}).bind(null, field.name, field.validator);
		}
	}

	static fieldIterator(fields)
	{
		let i = 0;
		return function(record, buffer, fields, resetIterator = false) {
			if (resetIterator)
				i = 0;
			while (i < fields.length)
			{
				if ((typeof (fields[i]['skip']) === 'function') && fields[i].skip(record, buffer, fields))
					i++;
				else
					return fields[i++];
			}
			i = 0;
		};
	}

	static setParent(target, parent)
	{
		if (!target.hasOwnProperty('__parent') && typeof parent !== 'undefined') {
			Object.defineProperty(target, '__parent', {
				value: parent,
				configurable: true,
				enumerable: false,
				writable: false
			});
		}
	}

	static parseArray(field, buffer, target = [], parent = undefined)
	{
		BinaryParserImpl.setParent(target, parent);
		while (field.hasNextItem(target, buffer))
			target.push(field.decoder(field.wrappedValidator(BinaryParserImpl.parseRecord(field.schema, buffer, target))));
		return target;
	}

	static parseRecord(schema, buffer, parent = undefined)
	{
		let result = Object.create((schema.class || Object).prototype);
		let fields = schema.fields || [];
		let iterator = (typeof schema.getNextField === 'function' ? schema.getNextField : schema.getNextField = BinaryParserImpl.fieldIterator(fields));
		
		BinaryParserImpl.setParent(result, parent);
		
		let field = iterator(result, buffer, fields, true);
		while (field)
		{
			BinaryParserImpl.instrumentSchemaField(field, result, buffer);
				
			let item;
			if (field.type === 'array') {
				item = BinaryParserImpl.parseArray(field, buffer, result[field.name], result);
			} else if (field.type === 'record') {
				item = field.decoder(field.wrappedValidator(BinaryParserImpl.parseRecord(field.schema, buffer, result)));
			} else {
				item = field.decoder(field.wrappedValidator(field.parser.call(buffer)));
			}
			if (field.name !== '')
				result[field.name] = item;
			
			field = iterator(result, buffer, fields);
		}
		return result;
	}
}

module.exports = BinaryParserImpl;
