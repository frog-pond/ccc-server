/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface RouteTimetable {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * Note:
	 * This is a Foreign Key to `route_stop.id`.<fk table='route_stop' column='id'/>
	 * @format uuid
	 */
	inbound_stop?: string
	/** @format time without time zone */
	inbound_time?: string
	/**
	 * Note:
	 * This is a Foreign Key to `route_stop.id`.<fk table='route_stop' column='id'/>
	 * @format uuid
	 */
	outbound_stop?: string
	/** @format time without time zone */
	outbound_time?: string
}

export interface Route {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	key: string
	/** @format text */
	title: string
}

export interface Livestream {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	title: string
	/** @format text */
	subtitle: string
	/** @format text */
	stream_uri: string
	/** @format text */
	tint_color?: string
	/** @format text */
	text_color?: string
	/** @format text */
	logo_uri?: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	calendar_source?: string
	/** @format text */
	phone?: string
	/** @format text */
	email?: string
	/** @format text */
	website?: string
}

export interface Cafe {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	name: string
	/** @format text */
	description?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location.id`.<fk table='location' column='id'/>
	 * @format uuid
	 */
	location?: string
}

export interface CafeCor {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format text
	 */
	id: string
	/** @format text */
	title: string
	/** @format text */
	description: string
	/** @format text */
	icon_uri: string
}

export interface CafeItem {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	title: string
	/** @format text */
	description?: string
	/** @format numeric */
	rating?: number
	/** @format jsonb */
	monotony: any
	/** @format jsonb */
	nutrition: any
}

export interface DirectoryEntryLocation {
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	directory_entry: string
	/**
	 * Note:
	 * This is a Foreign Key to `location.id`.<fk table='location' column='id'/>
	 * @format uuid
	 */
	location: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	title?: string
	/** @format text */
	email?: string
	/** @format text */
	phone?: string
	/** @format text */
	fax?: string
	/** @format text */
	hours?: string
	/** @format text */
	description?: string
}

/** the authoritative list of data sources, including manual data entry */
export interface DataSource {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * what type of source is this?
	 * @format text
	 */
	kind: string
	/**
	 * where did we start this scrape from?
	 * @format text
	 */
	uri?: string
}

export interface CafeStationMenu {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	station_title: string
	/** @format text */
	station_note?: string
	/** @format integer */
	station_sort_order: number
	/**
	 * Note:
	 * This is a Foreign Key to `cafe_item.id`.<fk table='cafe_item' column='id'/>
	 * @format uuid
	 */
	item_id: string
	/** @format integer */
	item_sort_order: number
	/**
	 * @format boolean
	 * @default false
	 */
	is_featured: boolean
}

export interface CalendarEventCategory {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `calendar_event.id`.<fk table='calendar_event' column='id'/>
	 * @format uuid
	 */
	calendar_event_id: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `content_category.id`.<fk table='content_category' column='id'/>
	 * @format uuid
	 */
	category_id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
}

export interface Feed {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	title: string
	/** @format text */
	uri: string
}

export interface ContentCategory {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/** @format text */
	title: string
	/** @format text */
	sort_title?: string
}

export interface Link {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	type: string
	/**
	 * @format text
	 * @default ""
	 */
	uri: string
	/** @format text */
	title: string
	/** @format text */
	sort_title?: string
	/**
	 * @format text
	 * @default ""
	 */
	subtitle: string
	/**
	 * @format text
	 * @default ""
	 */
	description: string
	/**
	 * @format text
	 * @default "#fff"
	 */
	tint_color: string
	/**
	 * @format text
	 * @default "#000"
	 */
	text_color: string
	/** @format text */
	image_uri?: string
	/**
	 * @format text
	 * @default ""
	 */
	sort_group: string
}

export interface DirectoryEntryOrganization {
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	directory_entry: string
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	directory_organization: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	role?: string
	/** @format text */
	title?: string
	/** @format text */
	email?: string
	/** @format text */
	phone?: string
	/** @format text */
	fax?: string
	/** @format text */
	hours?: string
	/** @format text */
	description?: string
}

export interface CafeItemCor {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `cafe_item.id`.<fk table='cafe_item' column='id'/>
	 * @format uuid
	 */
	cafe_item_id: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `cafe_cor.id`.<fk table='cafe_cor' column='id'/>
	 * @format text
	 */
	cafe_cor_id: string
}

export interface Metadata {
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format text
	 */
	key: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format text
	 * @default ""
	 */
	value: string
}

export interface StudentWork {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	position_title: string
	/** @format timestamp with time zone */
	posted_at: string
	/** @format text */
	category: string
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	department_id?: string
	/** @format text */
	department_name?: string
	/** @format text */
	classification?: string
	/** @format text */
	position_duration?: string
	/** @format text */
	description?: string
	/** @format text */
	pay_rate?: string
	/** @format text */
	skills?: string
	/** @format text */
	duties?: string
	/** @format text */
	qualifications?: string
}

export interface CalendarEvent {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * Note:
	 * This is a Foreign Key to `calendar_event.id`.<fk table='calendar_event' column='id'/>
	 * @format uuid
	 */
	recurrence_of_event_id?: string
	/** @format timestamp with time zone */
	start_time: string
	/** @format timestamp with time zone */
	end_time: string
	/** @format text */
	title: string
	/**
	 * @format text
	 * @default ""
	 */
	description: string
	/** @format text */
	thumbnail_uri?: string
	/** @format text */
	banner_uri?: string
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	sponsoring_entity?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location.id`.<fk table='location' column='id'/>
	 * @format uuid
	 */
	campus_location_id?: string
	/** @format text */
	textual_location?: string
}

export interface FeedArticleCategory {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `feed_article.id`.<fk table='feed_article' column='id'/>
	 * @format uuid
	 */
	feed_article_id: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `content_category.id`.<fk table='content_category' column='id'/>
	 * @format uuid
	 */
	category_id: string
}

export interface LocationCategory {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/** @format text */
	title: string
	/** @format text */
	sort_title?: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
}

export interface CafeMenuSchedule {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `location_schedule.id`.<fk table='location_schedule' column='id'/>
	 * @format uuid
	 */
	schedule_id: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `cafe_station_menu.id`.<fk table='cafe_station_menu' column='id'/>
	 * @format uuid
	 */
	station_id: string
}

export interface LocationSchedule {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * Note:
	 * This is a Foreign Key to `location_schedule.id`.<fk table='location_schedule' column='id'/>
	 * @format uuid
	 */
	parent_schedule?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location_category.id`.<fk table='location_category' column='id'/>
	 * @format uuid
	 */
	location_category?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location.id`.<fk table='location' column='id'/>
	 * @format uuid
	 */
	location?: string
	/** @format text */
	title: string
	/**
	 * @format text
	 * @default "open"
	 */
	status: string
	/** @format text */
	message?: string
	/** @format timestamp with time zone */
	active_from: string
	/** @format timestamp with time zone */
	active_until?: string
	/**
	 * @format text
	 * @default "*"
	 */
	audience: string
}

export interface AppNotice {
	/**
	 * The unique ID of each app notice
	 *
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * @format timestamp with time zone
	 * @default "CURRENT_TIMESTAMP"
	 */
	created_at: string
	/** @format text */
	title: string
	/** @format text */
	subtitle?: string
	/** @format text */
	body?: string
	/** @format text */
	severity: string
	/** @format timestamp with time zone */
	active_from?: string
	/** @format timestamp with time zone */
	active_until?: string
	/** @format text */
	app_version?: string
	/** @format text */
	platform?: string
}

export interface Location {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * @format uuid
	 * @default "15c7d6b1-4922-432c-8c1b-58d9ef60a791"
	 */
	source?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location.id`.<fk table='location' column='id'/>
	 * @format uuid
	 */
	within?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location_category.id`.<fk table='location_category' column='id'/>
	 * @format uuid
	 */
	category: string
	/**
	 * @format text
	 * @default ""
	 */
	title: string
	/**
	 * @format text
	 * @default ""
	 */
	subtitle: string
	/**
	 * @format text
	 * @default ""
	 */
	abbreviation: string
	/**
	 * @format text
	 * @default ""
	 */
	room_number: string
	/** @format jsonb */
	outline_shape: any
	/** @format jsonb */
	coordinates: any
	/**
	 * @format text
	 * @default ""
	 */
	banner_uri: string
	/**
	 * @format text
	 * @default ""
	 */
	icon_uri: string
	/**
	 * @format text
	 * @default ""
	 */
	website_uri: string
	/**
	 * @format text
	 * @default ""
	 */
	phone: string
	/**
	 * @format text
	 * @default ""
	 */
	email: string
}

export interface FeedArticle {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format timestamp with time zone */
	published_at: string
	/** @format timestamp with time zone */
	updated_at?: string
	/** @format text */
	title: string
	/**
	 * @format text
	 * @default ""
	 */
	body: string
	/** @format text */
	thumbnail_uri?: string
	/** @format text */
	banner_uri?: string
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	sponsoring_entity?: string
	/**
	 * Note:
	 * This is a Foreign Key to `location.id`.<fk table='location' column='id'/>
	 * @format uuid
	 */
	campus_location_id?: string
	/** @format text */
	textual_location?: string
}

export interface RouteStop {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	name: string
	/** @format jsonb */
	coordinates: any
}

export interface Dictionary {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * @format text
	 * @default ""
	 */
	uri: string
	/** @format text */
	title: string
	/** @format text */
	sort_title?: string
	/**
	 * @format text
	 * @default ""
	 */
	subtitle: string
	/**
	 * @format text
	 * @default ""
	 */
	description: string
	/**
	 * @format text
	 * @default "#fff"
	 */
	tint_color: string
	/**
	 * @format text
	 * @default "#000"
	 */
	text_color: string
	/** @format text */
	image_uri?: string
	/** @format text */
	sort_group: string
}

export interface RouteSchedule {
	/**
	 * Note:
	 * This is a Foreign Key to `route.id`.<fk table='route' column='id'/>
	 * @format uuid
	 */
	route_id: string
	/**
	 * Note:
	 * This is a Foreign Key to `route_timetable.id`.<fk table='route_timetable' column='id'/>
	 * @format uuid
	 */
	timetable_id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format timestamp with time zone */
	active_from?: string
	/** @format timestamp with time zone */
	active_until?: string
}

export interface CafeItemVariation {
	/**
	 * Note:
	 * This is a Foreign Key to `cafe_item.id`.<fk table='cafe_item' column='id'/>
	 * @format uuid
	 */
	cafe_item_id: string
	/** @format text */
	title: string
	/** @format text */
	description?: string
}

export interface CalendarEventLink {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * This is a Foreign Key to `calendar_event.id`.<fk table='calendar_event' column='id'/>
	 * @format uuid
	 */
	calendar_event_id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format text
	 */
	href: string
	/** @format text */
	title: string
	/** @format text */
	content_type?: string
	/** @format text */
	link_mode: string
}

export interface DirectoryEntry {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/** @format text */
	name: string
	/** @format text */
	sort_name: string
	/** @format text */
	type: string
	/** @format text */
	phone?: string
	/** @format text */
	email?: string
	/** @format text */
	pronouns?: string
	/** @format text */
	profile_uri?: string
	/** @format text */
	profile_text?: string
	/** @format text */
	title?: string
	/** @format text */
	photo?: string
	/** @format text */
	office_hours?: string
	/** @format text */
	specialties?: string
}

export interface LocationScheduleTimetable {
	/**
	 * Note:
	 * This is a Primary Key.<pk/>
	 * @format uuid
	 * @default "extensions.uuid_generate_v4()"
	 */
	id: string
	/**
	 * Note:
	 * This is a Foreign Key to `data_source.id`.<fk table='data_source' column='id'/>
	 * @format uuid
	 */
	source: string
	/**
	 * Note:
	 * This is a Foreign Key to `location_schedule.id`.<fk table='location_schedule' column='id'/>
	 * @format uuid
	 */
	location_schedule_id: string
	/** @format text */
	days: string
	/** @format time without time zone */
	open_at: string
	/** @format interval */
	open_for: string
}

export interface DirectoryEntryCategory {
	/**
	 * Note:
	 * This is a Foreign Key to `directory_entry.id`.<fk table='directory_entry' column='id'/>
	 * @format uuid
	 */
	directory_entry?: string
	/** @format text */
	category: string
}

import type {
	BeforeRequestHook,
	Hooks,
	KyInstance,
	Options as KyOptions,
	NormalizedOptions,
	SearchParamsOption,
} from 'ky'
import ky from 'ky'

type KyResponse<Data> = Response & {
	json<T extends Data = Data>(): Promise<T>
}

export type ResponsePromise<Data> = {
	arrayBuffer: () => Promise<ArrayBuffer>
	blob: () => Promise<Blob>
	formData: () => Promise<FormData>
	json<T extends Data = Data>(): Promise<T>
	text: () => Promise<string>
} & Promise<KyResponse<Data>>

export type ResponseFormat = keyof Omit<Body, 'body' | 'bodyUsed'>

export interface FullRequestParams extends Omit<KyOptions, 'json' | 'body' | 'searchParams'> {
	/** set parameter to `true` for call `securityWorker` for this request */
	secure?: boolean
	/** request path */
	path: string
	/** content type of request body */
	type?: ContentType
	/** query params */
	query?: SearchParamsOption
	/** format of response (i.e. response.json() -> format: "json") */
	format?: ResponseFormat
	/** request body */
	body?: unknown
}

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'query' | 'path'>

export interface ApiConfig<SecurityDataType = unknown>
	extends Omit<KyOptions, 'data' | 'cancelToken'> {
	securityWorker?: (
		securityData: SecurityDataType | null,
	) => Promise<NormalizedOptions | void> | NormalizedOptions | void
	secure?: boolean
	format?: ResponseType
}

export enum ContentType {
	Json = 'application/json',
	FormData = 'multipart/form-data',
	UrlEncoded = 'application/x-www-form-urlencoded',
	Text = 'text/plain',
}

export class HttpClient<SecurityDataType = unknown> {
	public ky: KyInstance
	private securityData: SecurityDataType | null = null
	private securityWorker?: ApiConfig<SecurityDataType>['securityWorker']
	private secure?: boolean | undefined
	private format?: ResponseType | undefined

	constructor({securityWorker, secure, format, ...options}: ApiConfig<SecurityDataType> = {}) {
		this.ky = ky.create({...options, prefixUrl: options.prefixUrl || ''})
		this.secure = secure
		this.format = format
		this.securityWorker = securityWorker
	}

	public setSecurityData = (data: SecurityDataType | null) => {
		this.securityData = data
	}

	protected mergeRequestParams(params1: KyOptions, params2?: KyOptions): KyOptions {
		return {
			...params1,
			...params2,
			headers: {
				...params1.headers,
				...(params2 && params2.headers),
			},
		}
	}

	protected stringifyFormItem(formItem: unknown) {
		if (typeof formItem === 'object' && formItem !== null) {
			return JSON.stringify(formItem)
		} else {
			return `${formItem}`
		}
	}

	protected createFormData(input: Record<string, unknown>): FormData {
		return Object.keys(input || {}).reduce((formData, key) => {
			const property = input[key]
			const propertyContent: any[] = property instanceof Array ? property : [property]

			for (const formItem of propertyContent) {
				const isFileType = formItem instanceof Blob || formItem instanceof File
				formData.append(key, isFileType ? formItem : this.stringifyFormItem(formItem))
			}

			return formData
		}, new FormData())
	}

	public request = <T = any, _E = any>({
		secure = this.secure,
		path,
		type,
		query,
		format,
		body,
		...options
	}: FullRequestParams): ResponsePromise<T> => {
		if (body) {
			if (type === ContentType.FormData) {
				body =
					typeof body === 'object' ? this.createFormData(body as Record<string, unknown>) : body
			} else if (type === ContentType.Text) {
				body = typeof body !== 'string' ? JSON.stringify(body) : body
			}
		}

		let headers: Headers | Record<string, string | undefined> | undefined
		if (options.headers instanceof Headers) {
			headers = new Headers(options.headers)
			if (type && type !== ContentType.FormData) {
				headers.set('Content-Type', type)
			}
		} else {
			headers = {...options.headers} as Record<string, string | undefined>
			if (type && type !== ContentType.FormData) {
				headers['Content-Type'] = type
			}
		}

		let hooks: Hooks = {}
		if (secure && this.securityWorker) {
			const securityWorker: BeforeRequestHook = async (request, options) => {
				const secureOptions = await this.securityWorker!(this.securityData)
				if (secureOptions && typeof secureOptions === 'object') {
					let {headers = new Headers()} = options
					if (secureOptions.headers) {
						const mergedHeaders = new Headers(headers)
						const secureHeaders = new Headers(secureOptions.headers)
						secureHeaders.forEach((value, key) => {
							mergedHeaders.set(key, value)
						})
						headers = mergedHeaders
					}
					return new Request(request.url, {
						...options,
						...secureOptions,
						headers,
					})
				}
				return
			}

			hooks = {
				...options.hooks,
				beforeRequest:
					options.hooks && options.hooks.beforeRequest
						? [securityWorker, ...options.hooks.beforeRequest]
						: [securityWorker],
			}
		}

		const request = this.ky(path.replace(/^\//, ''), {
			...options,
			headers,
			searchParams: query,
			body: body as any,
			hooks,
		})

		return request
	}
}

/**
 * @title standard public schema
 * @version 12.0.2 (a4e00ff)
 * @baseUrl https://kusrnwijckyfvnkqdurl.supabase.co:443
 * @externalDocs https://postgrest.org/en/v12.0/api.html
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
	/**
	 * No description
	 *
	 * @tags Introspection
	 * @name GetRoot
	 * @summary OpenAPI description (this document)
	 * @request GET:/
	 */
	getRoot = (params: RequestParams = {}) =>
		this.request<void, any>({
			path: `/`,
			method: 'GET',
			...params,
		})

	routeTimetable = {
		/**
		 * No description
		 *
		 * @tags route_timetable
		 * @name RouteTimetableList
		 * @request GET:/route_timetable
		 */
		routeTimetableList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				inbound_stop?: string
				/** @format time without time zone */
				inbound_time?: string
				/** @format uuid */
				outbound_stop?: string
				/** @format time without time zone */
				outbound_time?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<RouteTimetable[], any>({
				path: `/route_timetable`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_timetable
		 * @name RouteTimetableCreate
		 * @request POST:/route_timetable
		 */
		routeTimetableCreate: (
			route_timetable: RouteTimetable,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_timetable`,
				method: 'POST',
				query: query,
				body: route_timetable,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_timetable
		 * @name RouteTimetableDelete
		 * @request DELETE:/route_timetable
		 */
		routeTimetableDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				inbound_stop?: string
				/** @format time without time zone */
				inbound_time?: string
				/** @format uuid */
				outbound_stop?: string
				/** @format time without time zone */
				outbound_time?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_timetable`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_timetable
		 * @name RouteTimetablePartialUpdate
		 * @request PATCH:/route_timetable
		 */
		routeTimetablePartialUpdate: (
			route_timetable: RouteTimetable,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				inbound_stop?: string
				/** @format time without time zone */
				inbound_time?: string
				/** @format uuid */
				outbound_stop?: string
				/** @format time without time zone */
				outbound_time?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_timetable`,
				method: 'PATCH',
				query: query,
				body: route_timetable,
				...params,
			}),
	}
	route = {
		/**
		 * No description
		 *
		 * @tags route
		 * @name RouteList
		 * @request GET:/route
		 */
		routeList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				key?: string
				/** @format text */
				title?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Route[], any>({
				path: `/route`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route
		 * @name RouteCreate
		 * @request POST:/route
		 */
		routeCreate: (
			route: Route,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route`,
				method: 'POST',
				query: query,
				body: route,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route
		 * @name RouteDelete
		 * @request DELETE:/route
		 */
		routeDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				key?: string
				/** @format text */
				title?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route
		 * @name RoutePartialUpdate
		 * @request PATCH:/route
		 */
		routePartialUpdate: (
			route: Route,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				key?: string
				/** @format text */
				title?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route`,
				method: 'PATCH',
				query: query,
				body: route,
				...params,
			}),
	}
	livestream = {
		/**
		 * No description
		 *
		 * @tags livestream
		 * @name LivestreamList
		 * @request GET:/livestream
		 */
		livestreamList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				stream_uri?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				logo_uri?: string
				/** @format uuid */
				calendar_source?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** @format text */
				website?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Livestream[], any>({
				path: `/livestream`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags livestream
		 * @name LivestreamCreate
		 * @request POST:/livestream
		 */
		livestreamCreate: (
			livestream: Livestream,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/livestream`,
				method: 'POST',
				query: query,
				body: livestream,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags livestream
		 * @name LivestreamDelete
		 * @request DELETE:/livestream
		 */
		livestreamDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				stream_uri?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				logo_uri?: string
				/** @format uuid */
				calendar_source?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** @format text */
				website?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/livestream`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags livestream
		 * @name LivestreamPartialUpdate
		 * @request PATCH:/livestream
		 */
		livestreamPartialUpdate: (
			livestream: Livestream,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				stream_uri?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				logo_uri?: string
				/** @format uuid */
				calendar_source?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** @format text */
				website?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/livestream`,
				method: 'PATCH',
				query: query,
				body: livestream,
				...params,
			}),
	}
	cafe = {
		/**
		 * No description
		 *
		 * @tags cafe
		 * @name CafeList
		 * @request GET:/cafe
		 */
		cafeList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format text */
				description?: string
				/** @format uuid */
				location?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Cafe[], any>({
				path: `/cafe`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe
		 * @name CafeCreate
		 * @request POST:/cafe
		 */
		cafeCreate: (
			cafe: Cafe,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe`,
				method: 'POST',
				query: query,
				body: cafe,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe
		 * @name CafeDelete
		 * @request DELETE:/cafe
		 */
		cafeDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format text */
				description?: string
				/** @format uuid */
				location?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe
		 * @name CafePartialUpdate
		 * @request PATCH:/cafe
		 */
		cafePartialUpdate: (
			cafe: Cafe,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format text */
				description?: string
				/** @format uuid */
				location?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe`,
				method: 'PATCH',
				query: query,
				body: cafe,
				...params,
			}),
	}
	cafeCor = {
		/**
		 * No description
		 *
		 * @tags cafe_cor
		 * @name CafeCorList
		 * @request GET:/cafe_cor
		 */
		cafeCorList: (
			query?: {
				/** @format text */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format text */
				icon_uri?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CafeCor[], any>({
				path: `/cafe_cor`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_cor
		 * @name CafeCorCreate
		 * @request POST:/cafe_cor
		 */
		cafeCorCreate: (
			cafe_cor: CafeCor,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_cor`,
				method: 'POST',
				query: query,
				body: cafe_cor,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_cor
		 * @name CafeCorDelete
		 * @request DELETE:/cafe_cor
		 */
		cafeCorDelete: (
			query?: {
				/** @format text */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format text */
				icon_uri?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_cor`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_cor
		 * @name CafeCorPartialUpdate
		 * @request PATCH:/cafe_cor
		 */
		cafeCorPartialUpdate: (
			cafe_cor: CafeCor,
			query?: {
				/** @format text */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format text */
				icon_uri?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_cor`,
				method: 'PATCH',
				query: query,
				body: cafe_cor,
				...params,
			}),
	}
	cafeItem = {
		/**
		 * No description
		 *
		 * @tags cafe_item
		 * @name CafeItemList
		 * @request GET:/cafe_item
		 */
		cafeItemList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format numeric */
				rating?: string
				/** @format jsonb */
				monotony?: string
				/** @format jsonb */
				nutrition?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CafeItem[], any>({
				path: `/cafe_item`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item
		 * @name CafeItemCreate
		 * @request POST:/cafe_item
		 */
		cafeItemCreate: (
			cafe_item: CafeItem,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item`,
				method: 'POST',
				query: query,
				body: cafe_item,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item
		 * @name CafeItemDelete
		 * @request DELETE:/cafe_item
		 */
		cafeItemDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format numeric */
				rating?: string
				/** @format jsonb */
				monotony?: string
				/** @format jsonb */
				nutrition?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item
		 * @name CafeItemPartialUpdate
		 * @request PATCH:/cafe_item
		 */
		cafeItemPartialUpdate: (
			cafe_item: CafeItem,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format numeric */
				rating?: string
				/** @format jsonb */
				monotony?: string
				/** @format jsonb */
				nutrition?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item`,
				method: 'PATCH',
				query: query,
				body: cafe_item,
				...params,
			}),
	}
	directoryEntryLocation = {
		/**
		 * No description
		 *
		 * @tags directory_entry_location
		 * @name DirectoryEntryLocationList
		 * @request GET:/directory_entry_location
		 */
		directoryEntryLocationList: (
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format uuid */
				location?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				email?: string
				/** @format text */
				phone?: string
				/** @format text */
				fax?: string
				/** @format text */
				hours?: string
				/** @format text */
				description?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<DirectoryEntryLocation[], any>({
				path: `/directory_entry_location`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_location
		 * @name DirectoryEntryLocationCreate
		 * @request POST:/directory_entry_location
		 */
		directoryEntryLocationCreate: (
			directory_entry_location: DirectoryEntryLocation,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_location`,
				method: 'POST',
				query: query,
				body: directory_entry_location,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_location
		 * @name DirectoryEntryLocationDelete
		 * @request DELETE:/directory_entry_location
		 */
		directoryEntryLocationDelete: (
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format uuid */
				location?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				email?: string
				/** @format text */
				phone?: string
				/** @format text */
				fax?: string
				/** @format text */
				hours?: string
				/** @format text */
				description?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_location`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_location
		 * @name DirectoryEntryLocationPartialUpdate
		 * @request PATCH:/directory_entry_location
		 */
		directoryEntryLocationPartialUpdate: (
			directory_entry_location: DirectoryEntryLocation,
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format uuid */
				location?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				email?: string
				/** @format text */
				phone?: string
				/** @format text */
				fax?: string
				/** @format text */
				hours?: string
				/** @format text */
				description?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_location`,
				method: 'PATCH',
				query: query,
				body: directory_entry_location,
				...params,
			}),
	}
	dataSource = {
		/**
		 * No description
		 *
		 * @tags data_source
		 * @name DataSourceList
		 * @summary the authoritative list of data sources, including manual data entry
		 * @request GET:/data_source
		 */
		dataSourceList: (
			query?: {
				/** @format uuid */
				id?: string
				/**
				 * what type of source is this?
				 * @format text
				 */
				kind?: string
				/**
				 * where did we start this scrape from?
				 * @format text
				 */
				uri?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<DataSource[], any>({
				path: `/data_source`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags data_source
		 * @name DataSourceCreate
		 * @summary the authoritative list of data sources, including manual data entry
		 * @request POST:/data_source
		 */
		dataSourceCreate: (
			data_source: DataSource,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/data_source`,
				method: 'POST',
				query: query,
				body: data_source,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags data_source
		 * @name DataSourceDelete
		 * @summary the authoritative list of data sources, including manual data entry
		 * @request DELETE:/data_source
		 */
		dataSourceDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/**
				 * what type of source is this?
				 * @format text
				 */
				kind?: string
				/**
				 * where did we start this scrape from?
				 * @format text
				 */
				uri?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/data_source`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags data_source
		 * @name DataSourcePartialUpdate
		 * @summary the authoritative list of data sources, including manual data entry
		 * @request PATCH:/data_source
		 */
		dataSourcePartialUpdate: (
			data_source: DataSource,
			query?: {
				/** @format uuid */
				id?: string
				/**
				 * what type of source is this?
				 * @format text
				 */
				kind?: string
				/**
				 * where did we start this scrape from?
				 * @format text
				 */
				uri?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/data_source`,
				method: 'PATCH',
				query: query,
				body: data_source,
				...params,
			}),
	}
	cafeStationMenu = {
		/**
		 * No description
		 *
		 * @tags cafe_station_menu
		 * @name CafeStationMenuList
		 * @request GET:/cafe_station_menu
		 */
		cafeStationMenuList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				station_title?: string
				/** @format text */
				station_note?: string
				/** @format integer */
				station_sort_order?: string
				/** @format uuid */
				item_id?: string
				/** @format integer */
				item_sort_order?: string
				/** @format boolean */
				is_featured?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CafeStationMenu[], any>({
				path: `/cafe_station_menu`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_station_menu
		 * @name CafeStationMenuCreate
		 * @request POST:/cafe_station_menu
		 */
		cafeStationMenuCreate: (
			cafe_station_menu: CafeStationMenu,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_station_menu`,
				method: 'POST',
				query: query,
				body: cafe_station_menu,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_station_menu
		 * @name CafeStationMenuDelete
		 * @request DELETE:/cafe_station_menu
		 */
		cafeStationMenuDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				station_title?: string
				/** @format text */
				station_note?: string
				/** @format integer */
				station_sort_order?: string
				/** @format uuid */
				item_id?: string
				/** @format integer */
				item_sort_order?: string
				/** @format boolean */
				is_featured?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_station_menu`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_station_menu
		 * @name CafeStationMenuPartialUpdate
		 * @request PATCH:/cafe_station_menu
		 */
		cafeStationMenuPartialUpdate: (
			cafe_station_menu: CafeStationMenu,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				station_title?: string
				/** @format text */
				station_note?: string
				/** @format integer */
				station_sort_order?: string
				/** @format uuid */
				item_id?: string
				/** @format integer */
				item_sort_order?: string
				/** @format boolean */
				is_featured?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_station_menu`,
				method: 'PATCH',
				query: query,
				body: cafe_station_menu,
				...params,
			}),
	}
	calendarEventCategory = {
		/**
		 * No description
		 *
		 * @tags calendar_event_category
		 * @name CalendarEventCategoryList
		 * @request GET:/calendar_event_category
		 */
		calendarEventCategoryList: (
			query?: {
				/** @format uuid */
				calendar_event_id?: string
				/** @format uuid */
				category_id?: string
				/** @format uuid */
				source?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CalendarEventCategory[], any>({
				path: `/calendar_event_category`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event_category
		 * @name CalendarEventCategoryCreate
		 * @request POST:/calendar_event_category
		 */
		calendarEventCategoryCreate: (
			calendar_event_category: CalendarEventCategory,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event_category`,
				method: 'POST',
				query: query,
				body: calendar_event_category,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event_category
		 * @name CalendarEventCategoryDelete
		 * @request DELETE:/calendar_event_category
		 */
		calendarEventCategoryDelete: (
			query?: {
				/** @format uuid */
				calendar_event_id?: string
				/** @format uuid */
				category_id?: string
				/** @format uuid */
				source?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event_category`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event_category
		 * @name CalendarEventCategoryPartialUpdate
		 * @request PATCH:/calendar_event_category
		 */
		calendarEventCategoryPartialUpdate: (
			calendar_event_category: CalendarEventCategory,
			query?: {
				/** @format uuid */
				calendar_event_id?: string
				/** @format uuid */
				category_id?: string
				/** @format uuid */
				source?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event_category`,
				method: 'PATCH',
				query: query,
				body: calendar_event_category,
				...params,
			}),
	}
	feed = {
		/**
		 * No description
		 *
		 * @tags feed
		 * @name FeedList
		 * @request GET:/feed
		 */
		feedList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				uri?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Feed[], any>({
				path: `/feed`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed
		 * @name FeedCreate
		 * @request POST:/feed
		 */
		feedCreate: (
			feed: Feed,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed`,
				method: 'POST',
				query: query,
				body: feed,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed
		 * @name FeedDelete
		 * @request DELETE:/feed
		 */
		feedDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				uri?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed
		 * @name FeedPartialUpdate
		 * @request PATCH:/feed
		 */
		feedPartialUpdate: (
			feed: Feed,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				title?: string
				/** @format text */
				uri?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed`,
				method: 'PATCH',
				query: query,
				body: feed,
				...params,
			}),
	}
	contentCategory = {
		/**
		 * No description
		 *
		 * @tags content_category
		 * @name ContentCategoryList
		 * @request GET:/content_category
		 */
		contentCategoryList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<ContentCategory[], any>({
				path: `/content_category`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags content_category
		 * @name ContentCategoryCreate
		 * @request POST:/content_category
		 */
		contentCategoryCreate: (
			content_category: ContentCategory,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/content_category`,
				method: 'POST',
				query: query,
				body: content_category,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags content_category
		 * @name ContentCategoryDelete
		 * @request DELETE:/content_category
		 */
		contentCategoryDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/content_category`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags content_category
		 * @name ContentCategoryPartialUpdate
		 * @request PATCH:/content_category
		 */
		contentCategoryPartialUpdate: (
			content_category: ContentCategory,
			query?: {
				/** @format uuid */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/content_category`,
				method: 'PATCH',
				query: query,
				body: content_category,
				...params,
			}),
	}
	link = {
		/**
		 * No description
		 *
		 * @tags link
		 * @name LinkList
		 * @request GET:/link
		 */
		linkList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				type?: string
				/** @format text */
				uri?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				description?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				image_uri?: string
				/** @format text */
				sort_group?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Link[], any>({
				path: `/link`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags link
		 * @name LinkCreate
		 * @request POST:/link
		 */
		linkCreate: (
			link: Link,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/link`,
				method: 'POST',
				query: query,
				body: link,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags link
		 * @name LinkDelete
		 * @request DELETE:/link
		 */
		linkDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				type?: string
				/** @format text */
				uri?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				description?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				image_uri?: string
				/** @format text */
				sort_group?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/link`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags link
		 * @name LinkPartialUpdate
		 * @request PATCH:/link
		 */
		linkPartialUpdate: (
			link: Link,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				type?: string
				/** @format text */
				uri?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				description?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				image_uri?: string
				/** @format text */
				sort_group?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/link`,
				method: 'PATCH',
				query: query,
				body: link,
				...params,
			}),
	}
	directoryEntryOrganization = {
		/**
		 * No description
		 *
		 * @tags directory_entry_organization
		 * @name DirectoryEntryOrganizationList
		 * @request GET:/directory_entry_organization
		 */
		directoryEntryOrganizationList: (
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format uuid */
				directory_organization?: string
				/** @format uuid */
				source?: string
				/** @format text */
				role?: string
				/** @format text */
				title?: string
				/** @format text */
				email?: string
				/** @format text */
				phone?: string
				/** @format text */
				fax?: string
				/** @format text */
				hours?: string
				/** @format text */
				description?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<DirectoryEntryOrganization[], any>({
				path: `/directory_entry_organization`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_organization
		 * @name DirectoryEntryOrganizationCreate
		 * @request POST:/directory_entry_organization
		 */
		directoryEntryOrganizationCreate: (
			directory_entry_organization: DirectoryEntryOrganization,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_organization`,
				method: 'POST',
				query: query,
				body: directory_entry_organization,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_organization
		 * @name DirectoryEntryOrganizationDelete
		 * @request DELETE:/directory_entry_organization
		 */
		directoryEntryOrganizationDelete: (
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format uuid */
				directory_organization?: string
				/** @format uuid */
				source?: string
				/** @format text */
				role?: string
				/** @format text */
				title?: string
				/** @format text */
				email?: string
				/** @format text */
				phone?: string
				/** @format text */
				fax?: string
				/** @format text */
				hours?: string
				/** @format text */
				description?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_organization`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_organization
		 * @name DirectoryEntryOrganizationPartialUpdate
		 * @request PATCH:/directory_entry_organization
		 */
		directoryEntryOrganizationPartialUpdate: (
			directory_entry_organization: DirectoryEntryOrganization,
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format uuid */
				directory_organization?: string
				/** @format uuid */
				source?: string
				/** @format text */
				role?: string
				/** @format text */
				title?: string
				/** @format text */
				email?: string
				/** @format text */
				phone?: string
				/** @format text */
				fax?: string
				/** @format text */
				hours?: string
				/** @format text */
				description?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_organization`,
				method: 'PATCH',
				query: query,
				body: directory_entry_organization,
				...params,
			}),
	}
	cafeItemCor = {
		/**
		 * No description
		 *
		 * @tags cafe_item_cor
		 * @name CafeItemCorList
		 * @request GET:/cafe_item_cor
		 */
		cafeItemCorList: (
			query?: {
				/** @format uuid */
				cafe_item_id?: string
				/** @format text */
				cafe_cor_id?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CafeItemCor[], any>({
				path: `/cafe_item_cor`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item_cor
		 * @name CafeItemCorCreate
		 * @request POST:/cafe_item_cor
		 */
		cafeItemCorCreate: (
			cafe_item_cor: CafeItemCor,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item_cor`,
				method: 'POST',
				query: query,
				body: cafe_item_cor,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item_cor
		 * @name CafeItemCorDelete
		 * @request DELETE:/cafe_item_cor
		 */
		cafeItemCorDelete: (
			query?: {
				/** @format uuid */
				cafe_item_id?: string
				/** @format text */
				cafe_cor_id?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item_cor`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item_cor
		 * @name CafeItemCorPartialUpdate
		 * @request PATCH:/cafe_item_cor
		 */
		cafeItemCorPartialUpdate: (
			cafe_item_cor: CafeItemCor,
			query?: {
				/** @format uuid */
				cafe_item_id?: string
				/** @format text */
				cafe_cor_id?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item_cor`,
				method: 'PATCH',
				query: query,
				body: cafe_item_cor,
				...params,
			}),
	}
	metadata = {
		/**
		 * No description
		 *
		 * @tags metadata
		 * @name MetadataList
		 * @request GET:/metadata
		 */
		metadataList: (
			query?: {
				/** @format uuid */
				source?: string
				/** @format text */
				key?: string
				/** @format text */
				value?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Metadata[], any>({
				path: `/metadata`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags metadata
		 * @name MetadataCreate
		 * @request POST:/metadata
		 */
		metadataCreate: (
			metadata: Metadata,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/metadata`,
				method: 'POST',
				query: query,
				body: metadata,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags metadata
		 * @name MetadataDelete
		 * @request DELETE:/metadata
		 */
		metadataDelete: (
			query?: {
				/** @format uuid */
				source?: string
				/** @format text */
				key?: string
				/** @format text */
				value?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/metadata`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags metadata
		 * @name MetadataPartialUpdate
		 * @request PATCH:/metadata
		 */
		metadataPartialUpdate: (
			metadata: Metadata,
			query?: {
				/** @format uuid */
				source?: string
				/** @format text */
				key?: string
				/** @format text */
				value?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/metadata`,
				method: 'PATCH',
				query: query,
				body: metadata,
				...params,
			}),
	}
	studentWork = {
		/**
		 * No description
		 *
		 * @tags student_work
		 * @name StudentWorkList
		 * @request GET:/student_work
		 */
		studentWorkList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				position_title?: string
				/** @format timestamp with time zone */
				posted_at?: string
				/** @format text */
				category?: string
				/** @format uuid */
				department_id?: string
				/** @format text */
				department_name?: string
				/** @format text */
				classification?: string
				/** @format text */
				position_duration?: string
				/** @format text */
				description?: string
				/** @format text */
				pay_rate?: string
				/** @format text */
				skills?: string
				/** @format text */
				duties?: string
				/** @format text */
				qualifications?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<StudentWork[], any>({
				path: `/student_work`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags student_work
		 * @name StudentWorkCreate
		 * @request POST:/student_work
		 */
		studentWorkCreate: (
			student_work: StudentWork,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/student_work`,
				method: 'POST',
				query: query,
				body: student_work,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags student_work
		 * @name StudentWorkDelete
		 * @request DELETE:/student_work
		 */
		studentWorkDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				position_title?: string
				/** @format timestamp with time zone */
				posted_at?: string
				/** @format text */
				category?: string
				/** @format uuid */
				department_id?: string
				/** @format text */
				department_name?: string
				/** @format text */
				classification?: string
				/** @format text */
				position_duration?: string
				/** @format text */
				description?: string
				/** @format text */
				pay_rate?: string
				/** @format text */
				skills?: string
				/** @format text */
				duties?: string
				/** @format text */
				qualifications?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/student_work`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags student_work
		 * @name StudentWorkPartialUpdate
		 * @request PATCH:/student_work
		 */
		studentWorkPartialUpdate: (
			student_work: StudentWork,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				position_title?: string
				/** @format timestamp with time zone */
				posted_at?: string
				/** @format text */
				category?: string
				/** @format uuid */
				department_id?: string
				/** @format text */
				department_name?: string
				/** @format text */
				classification?: string
				/** @format text */
				position_duration?: string
				/** @format text */
				description?: string
				/** @format text */
				pay_rate?: string
				/** @format text */
				skills?: string
				/** @format text */
				duties?: string
				/** @format text */
				qualifications?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/student_work`,
				method: 'PATCH',
				query: query,
				body: student_work,
				...params,
			}),
	}
	calendarEvent = {
		/**
		 * No description
		 *
		 * @tags calendar_event
		 * @name CalendarEventList
		 * @request GET:/calendar_event
		 */
		calendarEventList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				recurrence_of_event_id?: string
				/** @format timestamp with time zone */
				start_time?: string
				/** @format timestamp with time zone */
				end_time?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format text */
				thumbnail_uri?: string
				/** @format text */
				banner_uri?: string
				/** @format uuid */
				sponsoring_entity?: string
				/** @format uuid */
				campus_location_id?: string
				/** @format text */
				textual_location?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CalendarEvent[], any>({
				path: `/calendar_event`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event
		 * @name CalendarEventCreate
		 * @request POST:/calendar_event
		 */
		calendarEventCreate: (
			calendar_event: CalendarEvent,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event`,
				method: 'POST',
				query: query,
				body: calendar_event,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event
		 * @name CalendarEventDelete
		 * @request DELETE:/calendar_event
		 */
		calendarEventDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				recurrence_of_event_id?: string
				/** @format timestamp with time zone */
				start_time?: string
				/** @format timestamp with time zone */
				end_time?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format text */
				thumbnail_uri?: string
				/** @format text */
				banner_uri?: string
				/** @format uuid */
				sponsoring_entity?: string
				/** @format uuid */
				campus_location_id?: string
				/** @format text */
				textual_location?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event
		 * @name CalendarEventPartialUpdate
		 * @request PATCH:/calendar_event
		 */
		calendarEventPartialUpdate: (
			calendar_event: CalendarEvent,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				recurrence_of_event_id?: string
				/** @format timestamp with time zone */
				start_time?: string
				/** @format timestamp with time zone */
				end_time?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** @format text */
				thumbnail_uri?: string
				/** @format text */
				banner_uri?: string
				/** @format uuid */
				sponsoring_entity?: string
				/** @format uuid */
				campus_location_id?: string
				/** @format text */
				textual_location?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event`,
				method: 'PATCH',
				query: query,
				body: calendar_event,
				...params,
			}),
	}
	feedArticleCategory = {
		/**
		 * No description
		 *
		 * @tags feed_article_category
		 * @name FeedArticleCategoryList
		 * @request GET:/feed_article_category
		 */
		feedArticleCategoryList: (
			query?: {
				/** @format uuid */
				feed_article_id?: string
				/** @format uuid */
				category_id?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<FeedArticleCategory[], any>({
				path: `/feed_article_category`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed_article_category
		 * @name FeedArticleCategoryCreate
		 * @request POST:/feed_article_category
		 */
		feedArticleCategoryCreate: (
			feed_article_category: FeedArticleCategory,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed_article_category`,
				method: 'POST',
				query: query,
				body: feed_article_category,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed_article_category
		 * @name FeedArticleCategoryDelete
		 * @request DELETE:/feed_article_category
		 */
		feedArticleCategoryDelete: (
			query?: {
				/** @format uuid */
				feed_article_id?: string
				/** @format uuid */
				category_id?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed_article_category`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed_article_category
		 * @name FeedArticleCategoryPartialUpdate
		 * @request PATCH:/feed_article_category
		 */
		feedArticleCategoryPartialUpdate: (
			feed_article_category: FeedArticleCategory,
			query?: {
				/** @format uuid */
				feed_article_id?: string
				/** @format uuid */
				category_id?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed_article_category`,
				method: 'PATCH',
				query: query,
				body: feed_article_category,
				...params,
			}),
	}
	locationCategory = {
		/**
		 * No description
		 *
		 * @tags location_category
		 * @name LocationCategoryList
		 * @request GET:/location_category
		 */
		locationCategoryList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format uuid */
				source?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<LocationCategory[], any>({
				path: `/location_category`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_category
		 * @name LocationCategoryCreate
		 * @request POST:/location_category
		 */
		locationCategoryCreate: (
			location_category: LocationCategory,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_category`,
				method: 'POST',
				query: query,
				body: location_category,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_category
		 * @name LocationCategoryDelete
		 * @request DELETE:/location_category
		 */
		locationCategoryDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format uuid */
				source?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_category`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_category
		 * @name LocationCategoryPartialUpdate
		 * @request PATCH:/location_category
		 */
		locationCategoryPartialUpdate: (
			location_category: LocationCategory,
			query?: {
				/** @format uuid */
				id?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format uuid */
				source?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_category`,
				method: 'PATCH',
				query: query,
				body: location_category,
				...params,
			}),
	}
	cafeMenuSchedule = {
		/**
		 * No description
		 *
		 * @tags cafe_menu_schedule
		 * @name CafeMenuScheduleList
		 * @request GET:/cafe_menu_schedule
		 */
		cafeMenuScheduleList: (
			query?: {
				/** @format uuid */
				schedule_id?: string
				/** @format uuid */
				station_id?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CafeMenuSchedule[], any>({
				path: `/cafe_menu_schedule`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_menu_schedule
		 * @name CafeMenuScheduleCreate
		 * @request POST:/cafe_menu_schedule
		 */
		cafeMenuScheduleCreate: (
			cafe_menu_schedule: CafeMenuSchedule,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_menu_schedule`,
				method: 'POST',
				query: query,
				body: cafe_menu_schedule,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_menu_schedule
		 * @name CafeMenuScheduleDelete
		 * @request DELETE:/cafe_menu_schedule
		 */
		cafeMenuScheduleDelete: (
			query?: {
				/** @format uuid */
				schedule_id?: string
				/** @format uuid */
				station_id?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_menu_schedule`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_menu_schedule
		 * @name CafeMenuSchedulePartialUpdate
		 * @request PATCH:/cafe_menu_schedule
		 */
		cafeMenuSchedulePartialUpdate: (
			cafe_menu_schedule: CafeMenuSchedule,
			query?: {
				/** @format uuid */
				schedule_id?: string
				/** @format uuid */
				station_id?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_menu_schedule`,
				method: 'PATCH',
				query: query,
				body: cafe_menu_schedule,
				...params,
			}),
	}
	locationSchedule = {
		/**
		 * No description
		 *
		 * @tags location_schedule
		 * @name LocationScheduleList
		 * @request GET:/location_schedule
		 */
		locationScheduleList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				parent_schedule?: string
				/** @format uuid */
				location_category?: string
				/** @format uuid */
				location?: string
				/** @format text */
				title?: string
				/** @format text */
				status?: string
				/** @format text */
				message?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** @format text */
				audience?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<LocationSchedule[], any>({
				path: `/location_schedule`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_schedule
		 * @name LocationScheduleCreate
		 * @request POST:/location_schedule
		 */
		locationScheduleCreate: (
			location_schedule: LocationSchedule,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_schedule`,
				method: 'POST',
				query: query,
				body: location_schedule,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_schedule
		 * @name LocationScheduleDelete
		 * @request DELETE:/location_schedule
		 */
		locationScheduleDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				parent_schedule?: string
				/** @format uuid */
				location_category?: string
				/** @format uuid */
				location?: string
				/** @format text */
				title?: string
				/** @format text */
				status?: string
				/** @format text */
				message?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** @format text */
				audience?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_schedule`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_schedule
		 * @name LocationSchedulePartialUpdate
		 * @request PATCH:/location_schedule
		 */
		locationSchedulePartialUpdate: (
			location_schedule: LocationSchedule,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				parent_schedule?: string
				/** @format uuid */
				location_category?: string
				/** @format uuid */
				location?: string
				/** @format text */
				title?: string
				/** @format text */
				status?: string
				/** @format text */
				message?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** @format text */
				audience?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_schedule`,
				method: 'PATCH',
				query: query,
				body: location_schedule,
				...params,
			}),
	}
	appNotice = {
		/**
		 * No description
		 *
		 * @tags app_notice
		 * @name AppNoticeList
		 * @request GET:/app_notice
		 */
		appNoticeList: (
			query?: {
				/**
				 * The unique ID of each app notice
				 * @format uuid
				 */
				id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				created_at?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				body?: string
				/** @format text */
				severity?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** @format text */
				app_version?: string
				/** @format text */
				platform?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<AppNotice[], any>({
				path: `/app_notice`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags app_notice
		 * @name AppNoticeCreate
		 * @request POST:/app_notice
		 */
		appNoticeCreate: (
			app_notice: AppNotice,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/app_notice`,
				method: 'POST',
				query: query,
				body: app_notice,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags app_notice
		 * @name AppNoticeDelete
		 * @request DELETE:/app_notice
		 */
		appNoticeDelete: (
			query?: {
				/**
				 * The unique ID of each app notice
				 * @format uuid
				 */
				id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				created_at?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				body?: string
				/** @format text */
				severity?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** @format text */
				app_version?: string
				/** @format text */
				platform?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/app_notice`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags app_notice
		 * @name AppNoticePartialUpdate
		 * @request PATCH:/app_notice
		 */
		appNoticePartialUpdate: (
			app_notice: AppNotice,
			query?: {
				/**
				 * The unique ID of each app notice
				 * @format uuid
				 */
				id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				created_at?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				body?: string
				/** @format text */
				severity?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** @format text */
				app_version?: string
				/** @format text */
				platform?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/app_notice`,
				method: 'PATCH',
				query: query,
				body: app_notice,
				...params,
			}),
	}
	location = {
		/**
		 * No description
		 *
		 * @tags location
		 * @name LocationList
		 * @request GET:/location
		 */
		locationList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				within?: string
				/** @format uuid */
				category?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				abbreviation?: string
				/** @format text */
				room_number?: string
				/** @format jsonb */
				outline_shape?: string
				/** @format jsonb */
				coordinates?: string
				/** @format text */
				banner_uri?: string
				/** @format text */
				icon_uri?: string
				/** @format text */
				website_uri?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Location[], any>({
				path: `/location`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location
		 * @name LocationCreate
		 * @request POST:/location
		 */
		locationCreate: (
			location: Location,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location`,
				method: 'POST',
				query: query,
				body: location,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location
		 * @name LocationDelete
		 * @request DELETE:/location
		 */
		locationDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				within?: string
				/** @format uuid */
				category?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				abbreviation?: string
				/** @format text */
				room_number?: string
				/** @format jsonb */
				outline_shape?: string
				/** @format jsonb */
				coordinates?: string
				/** @format text */
				banner_uri?: string
				/** @format text */
				icon_uri?: string
				/** @format text */
				website_uri?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location
		 * @name LocationPartialUpdate
		 * @request PATCH:/location
		 */
		locationPartialUpdate: (
			location: Location,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				within?: string
				/** @format uuid */
				category?: string
				/** @format text */
				title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				abbreviation?: string
				/** @format text */
				room_number?: string
				/** @format jsonb */
				outline_shape?: string
				/** @format jsonb */
				coordinates?: string
				/** @format text */
				banner_uri?: string
				/** @format text */
				icon_uri?: string
				/** @format text */
				website_uri?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location`,
				method: 'PATCH',
				query: query,
				body: location,
				...params,
			}),
	}
	feedArticle = {
		/**
		 * No description
		 *
		 * @tags feed_article
		 * @name FeedArticleList
		 * @request GET:/feed_article
		 */
		feedArticleList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				published_at?: string
				/** @format timestamp with time zone */
				updated_at?: string
				/** @format text */
				title?: string
				/** @format text */
				body?: string
				/** @format text */
				thumbnail_uri?: string
				/** @format text */
				banner_uri?: string
				/** @format uuid */
				sponsoring_entity?: string
				/** @format uuid */
				campus_location_id?: string
				/** @format text */
				textual_location?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<FeedArticle[], any>({
				path: `/feed_article`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed_article
		 * @name FeedArticleCreate
		 * @request POST:/feed_article
		 */
		feedArticleCreate: (
			feed_article: FeedArticle,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed_article`,
				method: 'POST',
				query: query,
				body: feed_article,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed_article
		 * @name FeedArticleDelete
		 * @request DELETE:/feed_article
		 */
		feedArticleDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				published_at?: string
				/** @format timestamp with time zone */
				updated_at?: string
				/** @format text */
				title?: string
				/** @format text */
				body?: string
				/** @format text */
				thumbnail_uri?: string
				/** @format text */
				banner_uri?: string
				/** @format uuid */
				sponsoring_entity?: string
				/** @format uuid */
				campus_location_id?: string
				/** @format text */
				textual_location?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed_article`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags feed_article
		 * @name FeedArticlePartialUpdate
		 * @request PATCH:/feed_article
		 */
		feedArticlePartialUpdate: (
			feed_article: FeedArticle,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				published_at?: string
				/** @format timestamp with time zone */
				updated_at?: string
				/** @format text */
				title?: string
				/** @format text */
				body?: string
				/** @format text */
				thumbnail_uri?: string
				/** @format text */
				banner_uri?: string
				/** @format uuid */
				sponsoring_entity?: string
				/** @format uuid */
				campus_location_id?: string
				/** @format text */
				textual_location?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/feed_article`,
				method: 'PATCH',
				query: query,
				body: feed_article,
				...params,
			}),
	}
	routeStop = {
		/**
		 * No description
		 *
		 * @tags route_stop
		 * @name RouteStopList
		 * @request GET:/route_stop
		 */
		routeStopList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format jsonb */
				coordinates?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<RouteStop[], any>({
				path: `/route_stop`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_stop
		 * @name RouteStopCreate
		 * @request POST:/route_stop
		 */
		routeStopCreate: (
			route_stop: RouteStop,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_stop`,
				method: 'POST',
				query: query,
				body: route_stop,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_stop
		 * @name RouteStopDelete
		 * @request DELETE:/route_stop
		 */
		routeStopDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format jsonb */
				coordinates?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_stop`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_stop
		 * @name RouteStopPartialUpdate
		 * @request PATCH:/route_stop
		 */
		routeStopPartialUpdate: (
			route_stop: RouteStop,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format jsonb */
				coordinates?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_stop`,
				method: 'PATCH',
				query: query,
				body: route_stop,
				...params,
			}),
	}
	dictionary = {
		/**
		 * No description
		 *
		 * @tags dictionary
		 * @name DictionaryList
		 * @request GET:/dictionary
		 */
		dictionaryList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				uri?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				description?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				image_uri?: string
				/** @format text */
				sort_group?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<Dictionary[], any>({
				path: `/dictionary`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags dictionary
		 * @name DictionaryCreate
		 * @request POST:/dictionary
		 */
		dictionaryCreate: (
			dictionary: Dictionary,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/dictionary`,
				method: 'POST',
				query: query,
				body: dictionary,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags dictionary
		 * @name DictionaryDelete
		 * @request DELETE:/dictionary
		 */
		dictionaryDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				uri?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				description?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				image_uri?: string
				/** @format text */
				sort_group?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/dictionary`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags dictionary
		 * @name DictionaryPartialUpdate
		 * @request PATCH:/dictionary
		 */
		dictionaryPartialUpdate: (
			dictionary: Dictionary,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				uri?: string
				/** @format text */
				title?: string
				/** @format text */
				sort_title?: string
				/** @format text */
				subtitle?: string
				/** @format text */
				description?: string
				/** @format text */
				tint_color?: string
				/** @format text */
				text_color?: string
				/** @format text */
				image_uri?: string
				/** @format text */
				sort_group?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/dictionary`,
				method: 'PATCH',
				query: query,
				body: dictionary,
				...params,
			}),
	}
	routeSchedule = {
		/**
		 * No description
		 *
		 * @tags route_schedule
		 * @name RouteScheduleList
		 * @request GET:/route_schedule
		 */
		routeScheduleList: (
			query?: {
				/** @format uuid */
				route_id?: string
				/** @format uuid */
				timetable_id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<RouteSchedule[], any>({
				path: `/route_schedule`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_schedule
		 * @name RouteScheduleCreate
		 * @request POST:/route_schedule
		 */
		routeScheduleCreate: (
			route_schedule: RouteSchedule,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_schedule`,
				method: 'POST',
				query: query,
				body: route_schedule,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_schedule
		 * @name RouteScheduleDelete
		 * @request DELETE:/route_schedule
		 */
		routeScheduleDelete: (
			query?: {
				/** @format uuid */
				route_id?: string
				/** @format uuid */
				timetable_id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_schedule`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags route_schedule
		 * @name RouteSchedulePartialUpdate
		 * @request PATCH:/route_schedule
		 */
		routeSchedulePartialUpdate: (
			route_schedule: RouteSchedule,
			query?: {
				/** @format uuid */
				route_id?: string
				/** @format uuid */
				timetable_id?: string
				/** @format uuid */
				source?: string
				/** @format timestamp with time zone */
				active_from?: string
				/** @format timestamp with time zone */
				active_until?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/route_schedule`,
				method: 'PATCH',
				query: query,
				body: route_schedule,
				...params,
			}),
	}
	cafeItemVariation = {
		/**
		 * No description
		 *
		 * @tags cafe_item_variation
		 * @name CafeItemVariationList
		 * @request GET:/cafe_item_variation
		 */
		cafeItemVariationList: (
			query?: {
				/** @format uuid */
				cafe_item_id?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CafeItemVariation[], any>({
				path: `/cafe_item_variation`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item_variation
		 * @name CafeItemVariationCreate
		 * @request POST:/cafe_item_variation
		 */
		cafeItemVariationCreate: (
			cafe_item_variation: CafeItemVariation,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item_variation`,
				method: 'POST',
				query: query,
				body: cafe_item_variation,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item_variation
		 * @name CafeItemVariationDelete
		 * @request DELETE:/cafe_item_variation
		 */
		cafeItemVariationDelete: (
			query?: {
				/** @format uuid */
				cafe_item_id?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item_variation`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags cafe_item_variation
		 * @name CafeItemVariationPartialUpdate
		 * @request PATCH:/cafe_item_variation
		 */
		cafeItemVariationPartialUpdate: (
			cafe_item_variation: CafeItemVariation,
			query?: {
				/** @format uuid */
				cafe_item_id?: string
				/** @format text */
				title?: string
				/** @format text */
				description?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/cafe_item_variation`,
				method: 'PATCH',
				query: query,
				body: cafe_item_variation,
				...params,
			}),
	}
	calendarEventLink = {
		/**
		 * No description
		 *
		 * @tags calendar_event_link
		 * @name CalendarEventLinkList
		 * @request GET:/calendar_event_link
		 */
		calendarEventLinkList: (
			query?: {
				/** @format uuid */
				calendar_event_id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				href?: string
				/** @format text */
				title?: string
				/** @format text */
				content_type?: string
				/** @format text */
				link_mode?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<CalendarEventLink[], any>({
				path: `/calendar_event_link`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event_link
		 * @name CalendarEventLinkCreate
		 * @request POST:/calendar_event_link
		 */
		calendarEventLinkCreate: (
			calendar_event_link: CalendarEventLink,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event_link`,
				method: 'POST',
				query: query,
				body: calendar_event_link,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event_link
		 * @name CalendarEventLinkDelete
		 * @request DELETE:/calendar_event_link
		 */
		calendarEventLinkDelete: (
			query?: {
				/** @format uuid */
				calendar_event_id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				href?: string
				/** @format text */
				title?: string
				/** @format text */
				content_type?: string
				/** @format text */
				link_mode?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event_link`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags calendar_event_link
		 * @name CalendarEventLinkPartialUpdate
		 * @request PATCH:/calendar_event_link
		 */
		calendarEventLinkPartialUpdate: (
			calendar_event_link: CalendarEventLink,
			query?: {
				/** @format uuid */
				calendar_event_id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				href?: string
				/** @format text */
				title?: string
				/** @format text */
				content_type?: string
				/** @format text */
				link_mode?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/calendar_event_link`,
				method: 'PATCH',
				query: query,
				body: calendar_event_link,
				...params,
			}),
	}
	directoryEntry = {
		/**
		 * No description
		 *
		 * @tags directory_entry
		 * @name DirectoryEntryList
		 * @request GET:/directory_entry
		 */
		directoryEntryList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format text */
				sort_name?: string
				/** @format text */
				type?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** @format text */
				pronouns?: string
				/** @format text */
				profile_uri?: string
				/** @format text */
				profile_text?: string
				/** @format text */
				title?: string
				/** @format text */
				photo?: string
				/** @format text */
				office_hours?: string
				/** @format text */
				specialties?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<DirectoryEntry[], any>({
				path: `/directory_entry`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry
		 * @name DirectoryEntryCreate
		 * @request POST:/directory_entry
		 */
		directoryEntryCreate: (
			directory_entry: DirectoryEntry,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry`,
				method: 'POST',
				query: query,
				body: directory_entry,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry
		 * @name DirectoryEntryDelete
		 * @request DELETE:/directory_entry
		 */
		directoryEntryDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format text */
				sort_name?: string
				/** @format text */
				type?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** @format text */
				pronouns?: string
				/** @format text */
				profile_uri?: string
				/** @format text */
				profile_text?: string
				/** @format text */
				title?: string
				/** @format text */
				photo?: string
				/** @format text */
				office_hours?: string
				/** @format text */
				specialties?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry
		 * @name DirectoryEntryPartialUpdate
		 * @request PATCH:/directory_entry
		 */
		directoryEntryPartialUpdate: (
			directory_entry: DirectoryEntry,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format text */
				name?: string
				/** @format text */
				sort_name?: string
				/** @format text */
				type?: string
				/** @format text */
				phone?: string
				/** @format text */
				email?: string
				/** @format text */
				pronouns?: string
				/** @format text */
				profile_uri?: string
				/** @format text */
				profile_text?: string
				/** @format text */
				title?: string
				/** @format text */
				photo?: string
				/** @format text */
				office_hours?: string
				/** @format text */
				specialties?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry`,
				method: 'PATCH',
				query: query,
				body: directory_entry,
				...params,
			}),
	}
	locationScheduleTimetable = {
		/**
		 * No description
		 *
		 * @tags location_schedule_timetable
		 * @name LocationScheduleTimetableList
		 * @request GET:/location_schedule_timetable
		 */
		locationScheduleTimetableList: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				location_schedule_id?: string
				/** @format text */
				days?: string
				/** @format time without time zone */
				open_at?: string
				/** @format interval */
				open_for?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<LocationScheduleTimetable[], any>({
				path: `/location_schedule_timetable`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_schedule_timetable
		 * @name LocationScheduleTimetableCreate
		 * @request POST:/location_schedule_timetable
		 */
		locationScheduleTimetableCreate: (
			location_schedule_timetable: LocationScheduleTimetable,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_schedule_timetable`,
				method: 'POST',
				query: query,
				body: location_schedule_timetable,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_schedule_timetable
		 * @name LocationScheduleTimetableDelete
		 * @request DELETE:/location_schedule_timetable
		 */
		locationScheduleTimetableDelete: (
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				location_schedule_id?: string
				/** @format text */
				days?: string
				/** @format time without time zone */
				open_at?: string
				/** @format interval */
				open_for?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_schedule_timetable`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags location_schedule_timetable
		 * @name LocationScheduleTimetablePartialUpdate
		 * @request PATCH:/location_schedule_timetable
		 */
		locationScheduleTimetablePartialUpdate: (
			location_schedule_timetable: LocationScheduleTimetable,
			query?: {
				/** @format uuid */
				id?: string
				/** @format uuid */
				source?: string
				/** @format uuid */
				location_schedule_id?: string
				/** @format text */
				days?: string
				/** @format time without time zone */
				open_at?: string
				/** @format interval */
				open_for?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/location_schedule_timetable`,
				method: 'PATCH',
				query: query,
				body: location_schedule_timetable,
				...params,
			}),
	}
	directoryEntryCategory = {
		/**
		 * No description
		 *
		 * @tags directory_entry_category
		 * @name DirectoryEntryCategoryList
		 * @request GET:/directory_entry_category
		 */
		directoryEntryCategoryList: (
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format text */
				category?: string
				/** Filtering Columns */
				select?: string
				/** Ordering */
				order?: string
				/** Limiting and Pagination */
				offset?: string
				/** Limiting and Pagination */
				limit?: string
			},
			params: RequestParams = {},
		) =>
			this.request<DirectoryEntryCategory[], any>({
				path: `/directory_entry_category`,
				method: 'GET',
				query: query,
				format: 'json',
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_category
		 * @name DirectoryEntryCategoryCreate
		 * @request POST:/directory_entry_category
		 */
		directoryEntryCategoryCreate: (
			directory_entry_category: DirectoryEntryCategory,
			query?: {
				/** Filtering Columns */
				select?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_category`,
				method: 'POST',
				query: query,
				body: directory_entry_category,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_category
		 * @name DirectoryEntryCategoryDelete
		 * @request DELETE:/directory_entry_category
		 */
		directoryEntryCategoryDelete: (
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format text */
				category?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_category`,
				method: 'DELETE',
				query: query,
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags directory_entry_category
		 * @name DirectoryEntryCategoryPartialUpdate
		 * @request PATCH:/directory_entry_category
		 */
		directoryEntryCategoryPartialUpdate: (
			directory_entry_category: DirectoryEntryCategory,
			query?: {
				/** @format uuid */
				directory_entry?: string
				/** @format text */
				category?: string
			},
			params: RequestParams = {},
		) =>
			this.request<void, any>({
				path: `/directory_entry_category`,
				method: 'PATCH',
				query: query,
				body: directory_entry_category,
				...params,
			}),
	}
}
