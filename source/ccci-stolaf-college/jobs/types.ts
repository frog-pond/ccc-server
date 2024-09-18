import { z } from 'zod'

/**
 * Top level schemas
 */

const requisitionListSchema = z.object({
	Id: z.string(),
	Title: z.string(),
	PostedDate: z.string(),
	PostingEndDate: z.string().nullable(),
	Language: z.string(),
	PrimaryLocationCountry: z.string(),
	GeographyId: z.number(),
	HotJobFlag: z.boolean(),
	WorkplaceTypeCode: z.string().nullable(),
	JobFamily: z.string().nullable(),
	JobFunction: z.string().nullable(),
	WorkerType: z.string().nullable(),
	ContractType: z.string().nullable(),
	ManagerLevel: z.string().nullable(),
	JobSchedule: z.string().nullable(),
	JobShift: z.string().nullable(),
	JobType: z.string().nullable(),
	StudyLevel: z.string().nullable(),
	DomesticTravelRequired: z.string().nullable(),
	InternationalTravelRequired: z.string().nullable(),
	WorkDurationYears: z.string().nullable(),
	WorkDurationMonths: z.string().nullable(),
	WorkHours: z.string().nullable(),
	WorkDays: z.string().nullable(),
	LegalEmployer: z.string().nullable(),
	BusinessUnit: z.string().nullable(),
	Department: z.string().nullable(),
	Organization: z.string().nullable(),
	MediaThumbURL: z.string().nullable(),
	ShortDescriptionStr: z.string().nullable(),
	PrimaryLocation: z.string(),
	Distance: z.number(),
	TrendingFlag: z.boolean(),
	BeFirstToApplyFlag: z.boolean(),
	Relevancy: z.number(),
	WorkplaceType: z.string(),
	ExternalQualificationsStr: z.string().nullable(),
	ExternalResponsibilitiesStr: z.string().nullable(),
	secondaryLocations: z.array(z.any()),
	requisitionFlexFields: z.array(z.any())
})

const facetSchema = z.object({
	Id: z.union([z.string(), z.number()]),
	Name: z.string(),
	TotalCount: z.number()
})

const itemsSchema = z.object({
	SearchId: z.number(),
	Keyword: z.string().nullable(),
	CorrectedKeyword: z.string().nullable(),
	UseExactKeywordFlag: z.boolean(),
	SuggestedKeyword: z.string().nullable(),
	ExecuteSpellCheckFlag: z.boolean(),
	Location: z.string().nullable(),
	LocationId: z.string().nullable(),
	Radius: z.number(),
	RadiusUnit: z.string(),
	SelectedTitlesFacet: z.string().nullable(),
	SelectedCategoriesFacet: z.string().nullable(),
	SelectedPostingDatesFacet: z.string().nullable(),
	SelectedLocationsFacet: z.string().nullable(),
	LastSelectedFacet: z.string().nullable(),
	Facets: z.string(),
	Offset: z.number(),
	Limit: z.number(),
	SortBy: z.string(),
	TotalJobsCount: z.number(),
	Latitude: z.string().nullable(),
	Longitude: z.string().nullable(),
	SiteNumber: z.string(),
	JobFamilyId: z.string().nullable(),
	PostingStartDate: z.string().nullable(),
	PostingEndDate: z.string().nullable(),
	SelectedWorkLocationsFacet: z.string().nullable(),
	RequisitionId: z.string().nullable(),
	CandidateNumber: z.string().nullable(),
	WorkLocationZipCode: z.string().nullable(),
	WorkLocationCountryCode: z.string().nullable(),
	SelectedFlexFieldsFacets: z.string().nullable(),
	OrganizationId: z.string().nullable(),
	SelectedOrganizationsFacet: z.string().nullable(),
	UserTargetFacetName: z.string().nullable(),
	UserTargetFacetInputTerm: z.string().nullable(),
	HotJobFlag: z.boolean().nullable(),
	WorkplaceType: z.string().nullable(),
	SelectedWorkplaceTypesFacet: z.string().nullable(),
	BotQRShortCode: z.string().nullable(),
	requisitionList: z.array(requisitionListSchema),
	categoriesFacet: z.array(facetSchema),
	locationsFacet: z.array(facetSchema),
	postingDatesFacet: z.array(facetSchema),
	titlesFacet: z.array(z.any()),
	workLocationsFacet: z.array(facetSchema),
	flexFieldsFacet: z.array(z.any()),
	organizationsFacet: z.array(facetSchema),
	workplaceTypesFacet: z.array(facetSchema)
})

const linksSchema = z.object({
	rel: z.string(),
	href: z.string(),
	name: z.string(),
	kind: z.string()
})

export const JobsRootSchema = z.object({
	items: z.array(itemsSchema),
	count: z.number(),
	hasMore: z.boolean(),
	limit: z.number(),
	offset: z.number(),
	links: z.array(linksSchema)
})

export const JobSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	contactEmail: z.string().optional(),
	contactName: z.string().optional(),
	contactPhone: z.string().optional(),
	hoursPerWeek: z.string().optional(),
	howToApply: z.string().optional(),
	lastModified: z.string(),
	links: z.array(z.string()),
	office: z.string().optional(),
	openPositions: z.string().optional(),
	skills: z.string().optional(),
	timeline: z.string().optional(),
	type: z.string(),
	url: z.string(),
	year: z.string().optional(),
})

export type JobType = z.infer<typeof JobSchema>

/**
 * Detail level schemas
 */

const DetailLocationSchema = z.object({
	LocationId: z.number(),
	LocationName: z.string(),
	AddressLine1: z.string(),
	AddressLine2: z.string().nullable(),
	AddressLine3: z.string().nullable(),
	AddressLine4: z.string().nullable(),
	Building: z.string().nullable(),
	TownOrCity: z.string(),
	PostalCode: z.string(),
	Country: z.string(),
	Region1: z.string(),
	Region2: z.string(),
	Region3: z.string().nullable(),
	Longitude: z.string(),
	Latitude: z.string(),
})
  
const DetailPrimaryLocationCoordinatesSchema = z.object({
	GeographyNodeId: z.number(),
	GeographyId: z.number(),
	Latitude: z.string(),
	Longitude: z.string(),
	CountryCode: z.string(),
})

const DetailItemSchema = z.object({
	Id: z.string(),
	Title: z.string(),
	Category: z.string(),
	RequisitionType: z.string(),
	JobGrade: z.string().nullable(),
	RequisitionId: z.number(),
	ExternalPostedStartDate: z.string(),
	JobLevel: z.string().nullable(),
	JobSchedule: z.string(),
	JobShift: z.string().nullable(),
	StudyLevel: z.string().nullable(),
	InternationalTravelRequired: z.string().nullable(),
	ExternalContactName: z.string().nullable(),
	ExternalContactEmail: z.string().nullable(),
	ContractType: z.string().nullable(),
	ExternalPostedEndDate: z.string().nullable(),
	JobFamilyId: z.number(),
	GeographyId: z.number(),
	GeographyNodeId: z.number(),
	ExternalDescriptionStr: z.string(),
	CorporateDescriptionStr: z.string(),
	OrganizationDescriptionStr: z.string(),
	ShortDescriptionStr: z.string(),
	ContentLocale: z.string(),
	PrimaryLocation: z.string(),
	PrimaryLocationCountry: z.string(),
	ObjectVerNumberProfile: z.string().nullable(),
	ApplyWhenNotPostedFlag: z.boolean(),
	ExternalQualificationsStr: z.string(),
	InternalQualificationsStr: z.string(),
	InternalResponsibilitiesStr: z.string(),
	ExternalResponsibilitiesStr: z.string(),
	JobFunctionCode: z.string().nullable(),
	HotJobFlag: z.boolean(),
	TrendingFlag: z.boolean(),
	BeFirstToApplyFlag: z.boolean(),
	WorkplaceTypeCode: z.string().nullable(),
	WorkplaceType: z.string(),
	OtherRequisitionTitle: z.string().nullable(),
	NumberOfOpenings: z.number().nullable(),
	HiringManager: z.string().nullable(),
	Organization: z.string().nullable(),
	WorkerType: z.string().nullable(),
	JobType: z.string().nullable(),
	WorkMonths: z.string().nullable(),
	WorkYears: z.string().nullable(),
	WorkHours: z.string().nullable(),
	WorkDays: z.string().nullable(),
	LegalEmployer: z.string().nullable(),
	BusinessUnit: z.string().nullable(),
	Department: z.string().nullable(),
	DomesticTravelRequired: z.string().nullable(),
	JobFunction: z.string().nullable(),
	secondaryLocations: z.array(z.any()),
	media: z.array(z.any()),
	workLocation: z.array(DetailLocationSchema),
	otherWorkLocations: z.array(z.any()),
	requisitionFlexFields: z.array(z.any()),
	primaryLocationCoordinates: z.array(DetailPrimaryLocationCoordinatesSchema),
	skills: z.array(z.any()),
})

export const JobDetailSchema = z.object({
	items: z.array(DetailItemSchema),
	count: z.number(),
	hasMore: z.boolean(),
	limit: z.number(),
	offset: z.number(),
	links: z.array(z.object({
		rel: z.string(),
		href: z.string(),
		name: z.string(),
		kind: z.string(),
	})),
})


 export type JobDetailType = z.infer<typeof JobDetailSchema>
