import {test} from 'node:test'
import {
	advisorsOf,
	contactsOf,
	instagramLinks,
	markdownOf,
	portalFields,
	urlOrBlank,
} from './portal.ts'

/// A portal view cut down to the shape that matters: fields grouped under
/// `items`, a field standing alone as its own group, and the private fields
/// the reader must never pass on.
const PORTAL = {
	id: '084c6e75',
	fieldData: [
		{
			items: [
				{label: 'Organization Name', value: '¡Presente!'},
				{label: 'Oracle Fund Number', value: '91683'},
				{label: 'Meeting Time', value: ''},
			],
		},
		{label: 'Cover Image', value: 'https://stolaf-cdn.presence.io/cover.png'},
		{
			items: [
				{label: 'Primary Organization Contact', value: 'Fatima Mena-Salcedo & Diana Gutierrez'},
				{
					label: 'Primary Organization Contact Email',
					value: 'menasa1@stolaf.edu & gutier13@stolaf.edu',
				},
				{label: 'Advisor Name', value: 'Wendy Gonzalez'},
				{label: 'Advisor Email', value: 'gonzalez@stolaf.edu'},
			],
		},
		{items: [{label: 'Instagram Handle', value: '@presentestolaf'}]},
		{
			items: [
				{
					label: 'If you could do it all again, what would you do differently?',
					value: 'Better planning',
				},
				{
					label: 'Does your organization utilize space in student organization storage?',
					value: {itemValue: 'abc', name: 'Yes'},
				},
			],
		},
	],
}

void test('portalFields reads the allowlisted fields', (t) => {
	let fields = portalFields(PORTAL)
	t.assert.equal(fields.contactName, 'Fatima Mena-Salcedo & Diana Gutierrez')
	t.assert.equal(fields.advisorEmail, 'gonzalez@stolaf.edu')
	t.assert.equal(fields.instagram, '@presentestolaf')
})

void test('portalFields reads a field missing from the form as blank', (t) => {
	t.assert.equal(portalFields(PORTAL).officeHours, '')
})

void test('portalFields passes on nothing outside its allowlist', (t) => {
	let text = JSON.stringify(portalFields(PORTAL))
	t.assert.doesNotMatch(text, /91683/)
	t.assert.doesNotMatch(text, /Better planning/)
	t.assert.doesNotMatch(text, /cover\.png/)
})

/// The allowlisted fields, blank but for `overrides`.
function fields(overrides: Partial<ReturnType<typeof portalFields>>) {
	return {...portalFields({fieldData: []}), ...overrides}
}

void test('a lone contact', (t) => {
	t.assert.deepEqual(
		contactsOf(fields({contactName: 'Harry Schiller', contactEmail: 'schill8@stolaf.edu'})),
		[
			{
				firstName: 'Harry',
				lastName: 'Schiller',
				title: 'Primary Contact',
				email: 'schill8@stolaf.edu',
			},
		],
	)
})

void test('contacts joined by & are paired with their addresses', (t) => {
	let contacts = contactsOf(portalFields(PORTAL))
	t.assert.deepEqual(
		contacts.map((c) => [c.firstName, c.lastName, c.email]),
		[
			['Fatima', 'Mena-Salcedo', 'menasa1@stolaf.edu'],
			['Diana', 'Gutierrez', 'gutier13@stolaf.edu'],
		],
	)
})

void test('contacts joined by "or" are paired with their addresses', (t) => {
	let contacts = contactsOf(
		fields({
			contactName: 'Esther Staplin or Sydney Sjodin',
			contactEmail: 'stapli2@stolaf.edu or sjodin1@stolaf.edu',
		}),
	)
	t.assert.deepEqual(
		contacts.map((c) => c.email),
		['stapli2@stolaf.edu', 'sjodin1@stolaf.edu'],
	)
})

void test('several contacts sharing one address are one contact', (t) => {
	let contacts = contactsOf(
		fields({
			contactName: 'Garrett Fitzgerald & Kayla Gruenes',
			contactEmail: 'oleprogramming@stolaf.edu',
		}),
	)
	t.assert.equal(contacts.length, 1)
	t.assert.equal(
		`${contacts[0]?.firstName ?? ''} ${contacts[0]?.lastName ?? ''}`,
		'Garrett Fitzgerald & Kayla Gruenes',
	)
})

void test('addresses are lowercased', (t) => {
	t.assert.equal(
		contactsOf(fields({contactName: 'Kira Maeda', contactEmail: 'Maeda3@stolaf.edu'}))[0]?.email,
		'maeda3@stolaf.edu',
	)
})

void test('a contact with no address is left out', (t) => {
	t.assert.deepEqual(contactsOf(fields({contactName: 'Somebody'})), [])
})

void test('advisors are read like contacts', (t) => {
	t.assert.deepEqual(advisorsOf(portalFields(PORTAL)), [
		{name: 'Wendy Gonzalez', email: 'gonzalez@stolaf.edu'},
	])
	t.assert.deepEqual(advisorsOf(fields({})), [])
})

void test('instagram handles become profile links, with or without @', (t) => {
	t.assert.deepEqual(instagramLinks('@stolafchess'), ['https://www.instagram.com/stolafchess/'])
	t.assert.deepEqual(instagramLinks('kso.stolaf'), ['https://www.instagram.com/kso.stolaf/'])
	t.assert.deepEqual(instagramLinks('@rozelliiott, @cathal_mee'), [
		'https://www.instagram.com/rozelliiott/',
		'https://www.instagram.com/cathal_mee/',
	])
	t.assert.deepEqual(instagramLinks(''), [])
})

void test('only a web address passes as a link', (t) => {
	t.assert.equal(
		urlOrBlank('https://docs.google.com/document/d/1'),
		'https://docs.google.com/document/d/1',
	)
	t.assert.equal(urlOrBlank('see our doc'), '')
	t.assert.equal(urlOrBlank('javascript:alert(1)'), '')
})

void test('rich text is read as markdown', (t) => {
	t.assert.equal(markdownOf('<p>Everyone is <b>welcome</b>!</p>'), 'Everyone is **welcome**!')
})

/// Habitat for Humanity's, as Presence has it: one name to a paragraph, a
/// paste's leftover markers, and trailing breaks.
void test('each paragraph stays a paragraph of its own', (t) => {
	let html =
		'<p style="font-size: 14px;">Executive Committee: 2026 Fall</p>' +
		'<p style="font-size: 14px;">Yousef Abualatta</p>' +
		'<p style="font-size: 14px;"><!--StartFragment--><span>Alex Walk</span></p>' +
		'<p style="font-size: 14px;"><!--EndFragment-->Sam Fineran<br/><br/><br/></p>'
	t.assert.equal(
		markdownOf(html),
		'Executive Committee: 2026 Fall\n\nYousef Abualatta\n\nAlex Walk\n\nSam Fineran',
	)
})

void test('a short heading stays a heading', (t) => {
	t.assert.equal(
		markdownOf('<h1>Who Are We?</h1><p>A ministry.</p>'),
		'# Who Are We?\n\nA ministry.',
	)
})

/// Officers set whole paragraphs as headings for the size; AED's first
/// paragraph is a 35-word `<h3>`.
void test('a heading of more than ten words is a paragraph', (t) => {
	t.assert.equal(
		markdownOf(
			'<h3>We are a society that gives pre-health students resources and service opportunities.</h3>',
		),
		'We are a society that gives pre-health students resources and service opportunities.',
	)
	t.assert.equal(
		markdownOf('<h3>One two three four five six seven eight nine ten</h3>'),
		'### One two three four five six seven eight nine ten',
	)
})

void test('a paragraph entirely in bold or italics is plain', (t) => {
	t.assert.equal(
		markdownOf(
			'<p><b><span>All of it is bold.</span></b></p><p><i>All</i> <em>of it italic.</em></p>',
		),
		'All of it is bold.\n\nAll of it italic.',
	)
})

void test('a paragraph only partly in bold keeps its bold', (t) => {
	t.assert.equal(markdownOf('<p><b>Meetings:</b> Thursdays</p>'), '**Meetings:** Thursdays')
})

/// A paste from Google Docs wraps its text in a `<b>` set to normal weight.
void test("a Google Docs paste's wrapper is not bold", (t) => {
	t.assert.equal(
		markdownOf(
			'<b id="docs-internal-guid-f4d66d7b" style="font-weight:normal;"><p>Welcome, <b>everyone</b>.</p><p>Come by.</p></b>',
		),
		'Welcome, **everyone**.\n\nCome by.',
	)
})

void test('an unordered list is bulleted', (t) => {
	t.assert.equal(
		markdownOf('<ul><li>Come to <b>meetings</b></li><li>Volunteer</li></ul>'),
		'-   Come to **meetings**\n-   Volunteer',
	)
})

void test('an ordered list is numbered', (t) => {
	t.assert.equal(
		markdownOf('<ol><li>Be enrolled</li><li>Be kind</li></ol>'),
		'1.  Be enrolled\n2.  Be kind',
	)
})

/// Eight orgs put a paragraph inside each list item. Its markdown is a loose
/// list; the lines left holding only indentation are emptied.
void test("a list item's own paragraph leaves no whitespace-only lines", (t) => {
	let markdown = markdownOf('<ul><li><p>Workshops</p></li><li><p>Projects</p></li></ul>')
	t.assert.doesNotMatch(markdown, /^[ \t]+$/mu)
	t.assert.doesNotMatch(markdown, /\n{3}/u)
	t.assert.match(markdown, /^-\s+Workshops\n\n-\s+Projects$/u)
})

void test('zero-width characters the editor leaves behind are dropped', (t) => {
	t.assert.equal(
		markdownOf('<p>\u200BYou can also join us</p><p>\u200B</p>'),
		'You can also join us',
	)
})

void test('zero-width characters written as entities are dropped too', (t) => {
	t.assert.equal(
		markdownOf('<p>a senator who&#65279; can help&#8203;</p>'),
		'a senator who can help',
	)
})

void test('portalFields reads the statement of purpose', (t) => {
	let body = {fieldData: [{label: 'Statement of Purpose', value: '<p>We build homes.</p>'}]}
	t.assert.equal(portalFields(body).statementOfPurpose, '<p>We build homes.</p>')
})
