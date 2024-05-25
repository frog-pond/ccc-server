import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi'
import {z} from 'zod'
import {errorMap} from 'zod-validation-error'

extendZodWithOpenApi(z)
z.setErrorMap(errorMap)

export {api as v1} from './v1/index.js'
