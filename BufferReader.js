'use strict';

const StreamEndError = require('./StreamEndError.js');

class BufferReader
{
	constructor(buffer, isLittleEndian = false)
	{
		this.buffer = buffer;
		this.previousPosition = 0;
		this.position = 0;
		this.isLittleEndian = isLittleEndian;
	}
	
	_hasData(required = 0)
	{
		return this.position + required <= this.buffer.length;
	}
	
	_requireData(required = 1)
	{
		if (!this._hasData(required))
			throw new StreamEndError();
	}
	
	_advance(bytes = 0)
	{
		this.previousPosition = this.position;
		this.position = this.position + bytes;
	}

	skipBytes(bytes)
	{
		this._advance(bytes);
	}

	get leftBytes()
	{
		return Math.max(0, this.buffer.length - this.position);
	}
	
	readInt8()
	{
		this._requireData(1);
		let result = this.buffer.readInt8(this.position);
		this._advance(1);
		return result;
	}
		
	readInt16()
	{
		this._requireData(2);
		let result = (this.isLittleEndian ? this.buffer.readInt16LE(this.position) : this.buffer.readInt16BE(this.position));
		this._advance(2);
		return result;
	}
		
	readInt32()
	{
		this._requireData(4);
		let result = (this.isLittleEndian ? this.buffer.readInt32LE(this.position) : this.buffer.readInt32BE(this.position));
		this._advance(4);
		return result;
	}
	
	readUInt8()
	{
		this._requireData(1);
		let result = this.buffer.readUInt8(this.position);
		this._advance(1);
		return result;
	}
		
	readUInt16()
	{
		this._requireData(2);
		let result = (this.isLittleEndian ? this.buffer.readUInt16LE(this.position) : this.buffer.readUInt16BE(this.position));
		this._advance(2);
		return result;
	}
		
	readUInt32()
	{
		this._requireData(4);
		let result = (this.isLittleEndian ? this.buffer.readUInt32LE(this.position) : this.buffer.readUInt32BE(this.position));
		this._advance(4);
		return result;
	}
	
	readInt64()
	{
		let high, low;
		if (this.isLittleEndian) {
			low = this.readUInt32();
			high = this.readInt32();
		} else {
			high = this.readInt32();
			low = this.readUInt32();
		}
		return high * 4294967296.0 + low;
	}

	readString(byteLength, encoding = 'utf8')
	{
		this._requireData(byteLength);
		let result = this.buffer.toString(encoding, this.position, this.position + byteLength);
		this._advance(byteLength);
		return result;
	}

	readBuffer(byteLength)
	{
		this._requireData(byteLength);
		let result = Buffer.alloc(byteLength, this.buffer.slice(this.position, this.position + byteLength));
		this._advance(byteLength);
		return result;
	}
}

module.exports = BufferReader;
