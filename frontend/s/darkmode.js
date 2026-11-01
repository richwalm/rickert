'use strict';

let DarkMode = true;

function ChangeMode(ToDark) {
	if (DarkMode == ToDark)
		return false;
	document.body.style.background = ToDark ? 'black' : 'white';
	document.body.style.color = ToDark ? 'white' : 'black';
	console.log(`Theme has changed to ${ToDark ? 'dark' : 'light'}.`);
	DarkMode = ToDark;
	return true;
}

window.addEventListener('load', (e) => {
	const IsDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
	if (IsDarkMode)
		ChangeMode(IsDarkMode.matches);
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { ChangeMode(e.matches); });
