import {createClient} from '@supabase/supabase-js'
import {type Database} from './supabase-types.js'

let url = process.env['SUPABASE_URL'] ?? 'https://kusrnwijckyfvnkqdurl.supabase.co'
let key =
	process.env['SUPABASE_ANON_KEY'] ??
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1c3Jud2lqY2t5ZnZua3FkdXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTYxMzY1MTcsImV4cCI6MjAzMTcxMjUxN30.kZLvOeFpOUhAdYTlFzzGlFyZ_YsIydzhL528iTYq27Q'

export const supabase = createClient<Database>(url, key)

export * from './supabase-types.js'
