'use strict';

class SchemaError extends Error
{
	constructor(...args) {
		super(...args);
	}
}

module.exports = SchemaError;
