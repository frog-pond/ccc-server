import ExpiryMap from 'expiry-map'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from './constants.js'

export const ONE_MINUTE_CACHE = new ExpiryMap(ONE_MINUTE)
export const ONE_HOUR_CACHE = new ExpiryMap(ONE_HOUR)
export const ONE_DAY_CACHE = new ExpiryMap(ONE_DAY)
