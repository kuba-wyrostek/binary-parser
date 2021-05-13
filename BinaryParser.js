'use strict';

const BufferReader = require('./BufferReader.js');
const BinaryParserImpl = require('./BinaryParserImpl.js');

const StreamContentError = require('./StreamContentError.js');

class BinaryParser
{
	static parse(schema, buffer, isLittleEndian)
	{
		if (buffer instanceof Buffer)
			buffer = new BufferReader(buffer, isLittleEndian);
		else if (!buffer instanceof BufferReader)
			throw new Error('Buffer of BufferReader expected as a second argument.');

		schema = schema || {};

		try
		{
			return BinaryParserImpl.parseRecord(schema, buffer);
		}
		catch (error)
		{
			if (error instanceof StreamContentError)
			{
				error.originalBufferHEX = '0x' + buffer.buffer.slice(0, buffer.position).toString('hex');
				error.originalBufferASCII = buffer.buffer.slice(0, buffer.position).toString('ascii');
				error.problematicPosition = buffer.previousPosition;
				error.problematicLength = buffer.position - buffer.previousPosition;
			}
			throw error;
		}
	}
}

module.exports = BinaryParser;
