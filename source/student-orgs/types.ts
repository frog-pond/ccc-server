import {z} from 'zod'

export type ContactPersonType = z.infer<typeof ContactPersonSchema>
export const ContactPersonSchema = z.object({
	lastName: z.string(),
	firstName: z.string(),
	title: z.string(),
	email: z.string().email(),
})

export type AdvisorType = z.infer<typeof AdvisorSchema>
export const AdvisorSchema = z.object({
	name: z.string(),
	email: z.string().email(),
})

export type StudentOrgType = z.infer<typeof StudentOrgSchema>
export const StudentOrgSchema = z.object({
	meetings: z.string(),
	contacts: ContactPersonSchema.array(),
	advisors: AdvisorSchema.array(),
	description: z.string(),
	category: z.string(),
	lastUpdated: z.string(),
	website: z.string().optional().nullable(),
	name: z.string().min(1),
})

export type SortableStudentOrgType = z.infer<typeof SortableStudentOrgSchema>
export const SortableStudentOrgSchema = StudentOrgSchema.extend({
	$sortableName: z.string(),
	$groupableName: z.string(),
})
