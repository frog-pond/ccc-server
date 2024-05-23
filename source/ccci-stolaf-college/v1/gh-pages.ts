const BASE_URL = 'https://stodevx.github.io'

export const GH_PAGES = (filename: string) => {
	const url = new URL(BASE_URL)
	url.pathname = `/AAO-React-Native/${filename}`
	return url
}

export const GH_PAGES_FROM_REPO = (reponame: string, filename: string, ) => {
	const url = new URL(BASE_URL)
	url.pathname = `${reponame}/${filename}`
	return url
}
