import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi'
import {z} from 'zod'
extendZodWithOpenApi(z)

export {api as v1} from './v1/index.js'
