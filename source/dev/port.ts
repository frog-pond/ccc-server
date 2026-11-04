import {connect} from 'node:net'

/// Whether nothing answers on a local port. Checked by connecting rather than by
/// binding: Node binds with SO_REUSEADDR, so a bind can succeed beside a server
/// that listens on localhost alone.
export function portIsFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({port, host: '127.0.0.1'})
		socket.once('connect', () => {
			socket.destroy()
			resolve(false)
		})
		socket.once('error', () => {
			resolve(true)
		})
	})
}
