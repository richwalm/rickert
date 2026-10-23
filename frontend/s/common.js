'use strict';

export function GetExtension(String) {
	const LastSlash = String.lastIndexOf('/');
	const LastDot = String.lastIndexOf('.');
	if (LastSlash > LastDot || LastDot <= 0)
		return;
	return String.slice(LastDot + 1);
}

