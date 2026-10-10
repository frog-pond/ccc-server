/// BonApp café ids (what the apps ask for) to their pages. The same ids as
/// CAFE_ID_TO_URL in source/ccci-stolaf-college/v1/menu.ts, which this cannot
/// import: that file pulls in the Node server's http client.
export const CAFES: Record<string, string> = {
	'261': 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	'262': 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	'263': 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	'35': 'https://carleton.cafebonappetit.com/cafe/burton/',
	'36': 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	'34': 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	'458': 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
}

/// The cafés the named food routes (`/food/named/{menu,cafe}/<name>`) read, by
/// name, as CAFE_URLS and the named routes in source/ccci-stolaf-college/v1/menu.ts.
export const NAMED_CAFES: Record<string, string> = {
	'stav-hall': 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	'the-cage': 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	'kings-room': 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	'the-cave': 'https://stolaf.cafebonappetit.com/cafe/the-cave/',
	burton: 'https://carleton.cafebonappetit.com/cafe/burton/',
	ldc: 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	sayles: 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	weitz: 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
	schulze: 'https://carleton.cafebonappetit.com/cafe/schulze-cafe/',
}
