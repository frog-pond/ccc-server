import {z} from 'zod'
import {get} from '../ccc-lib/http.js'

export const DepartmentsResponseSchema = z.object({
	results: z.object({
		buildingroom: z.string().nullable(),
		buildingabbr: z.string().nullable(),
		buildingname: z.string().nullable(),
		extension: z.string().nullable(),
		text: z.string().nullable(),
		headcount: z.number(),
		email: z.string().email().nullable(),
		fax: z.string().nullable(),
		name: z.string(),
		website: z.string().url().nullable(),
	}),
})

export async function getDirectoryDepartments() {
	let url = new URL('https://www.stolaf.edu/directory/departments')
	return DepartmentsResponseSchema.parse(await get(url, {searchParams: {format: 'json'}}).json())
}

export const MajorsResponseSchema = z.object({
	results: z.object({
		headcount: z.number(),
		name: z.string(),
	}),
})

export async function getDirectoryMajors() {
	let url = new URL('https://www.stolaf.edu/directory/majors')
	return DepartmentsResponseSchema.parse(await get(url, {searchParams: {format: 'json'}}).json())
}
