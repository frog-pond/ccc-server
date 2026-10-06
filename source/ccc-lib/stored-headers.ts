/// WordPress's paging headers: how many items a list holds, and how many pages.
export const WORDPRESS_PAGING_HEADERS = ['x-wp-total', 'x-wp-totalpages']

/// The response headers the response cache keeps with a copy and gives back on
/// every hit: a list's RFC 8288 `Link` paging, and WordPress's totals. They
/// describe the content, so any route that sets them wants them kept.
export const STORED_HEADERS = ['link', ...WORDPRESS_PAGING_HEADERS]
