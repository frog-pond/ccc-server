import {spawn} from 'child_process'

const buildWatch = spawn('npm', ['run', 'build-watch'], {stdio: 'inherit'})
const startWatch = spawn('npm', ['run', 'start-watch'], {stdio: 'inherit'})

const shutdown = () => {
  buildWatch.kill()
  startWatch.kill()
  process.exit()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
