'use strict';

class StreamContentError extends Error
{
	constructor(fieldName, problematicValue) {
		super('Validation failed for data in stream' + (fieldName !== '' ? ' for field ' + fieldName : '') + '.');
		this.fieldName = fieldName;
		this.problematicValue = problematicValue;
	}
}

module.exports = StreamContentError;
