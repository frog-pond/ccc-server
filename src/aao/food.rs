extern crate reqwest;

use reqwest::Url;
use rocket::http::RawStr;
use rocket::request::FromParam;
use rocket_contrib::Json;
use std::result::Result;

mod cafe {
    use std::collections::HashMap;
    #[derive(Serialize, Deserialize, Debug)]
    pub struct Response {
        cafes: HashMap<String, Cafe>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct Cafe {
        name: String,
        address: String,
        city: String,
        state: String,
        zip: String,
        latitude: String,
        longitude: String,
        description: String,
        message: String,
        eod: String,
        timezone: String,
        menu_type: String,
        menu_html: String,
        location_detail: String,
        weekly_schedule: String,
        days: Vec<Schedule>,
        cor_icons: HashMap<String, CorData>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct CorData {
        sort: String,
        label: String,
        description: String,
        image: String,
        is_filter: String,
        allergen: u8,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct Schedule {
        date: String,
        dayparts: Vec<DayPart>,
        status: String,
        message: String,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct DayPart {
        id: String,
        starttime: String,
        endtime: String,
        message: String,
        label: String,
        hide: String,
    }
}

mod menu {
    use std::collections::HashMap;
    #[derive(Serialize, Deserialize, Debug)]
    pub struct Response {
        days: Vec<Schedule>,
        items: HashMap<String, MenuItem>,
        cor_icons: HashMap<String, CorData>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct CorData {
        sort: String,
        label: String,
        description: String,
        image: String,
        is_filter: String,
        allergen: u8,
        #[serde(rename = "type")]
        type_: String,
    }

    type MenuItemId = String;

    #[derive(Serialize, Deserialize, Debug)]
    struct MenuItem {
        id: MenuItemId,
        label: String,
        description: String,
        raw_cooked: String,
        zero_entree: String,
        #[serde(skip)]
        cor_icon: HashMap<String, String>,
        #[serde(skip)]
        ordered_cor_icon: HashMap<String, OrderedCorIcon>,
        price: String,
        sizes: Vec<String>,
        nutrition: BasicNutrition,
        special: u8,
        tier3: u8,
        #[serde(skip)]
        tier: String,
        rating: String,
        connector: String,
        options: Vec<String>,
        station_id: String,
        station: String,
        nutrition_details: NutritionDetails,
        ingredients: Option<String>,
        nutrition_link: String,
        sub_station: String,
        sub_station_id: String,
        sub_station_order: String,
        monotony: Monotony,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct OrderedCorIcon {
        id: String,
        label: String,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct BasicNutrition {
        kcal: String,
        well_being: String,
        well_being_image: String,
    }

    type NutritionDetails = HashMap<String, NutritionDetail>;

    // #[derive(Serialize, Deserialize, Debug)]
    // struct NutritionDetails {
    //     calories: NutritionDetail,
    //     #[serde(rename = "servingSize")]
    //     serving_size: NutritionDetail,
    //     #[serde(rename = "fatContent")]
    //     fat_content: NutritionDetail,
    //     #[serde(rename = "saturatedFatContent")]
    //     saturated_fat_content: NutritionDetail,
    //     #[serde(rename = "transFatContent")]
    //     trans_fat_content: NutritionDetail,
    //     #[serde(rename = "cholesterolContent")]
    //     cholesterol_content: NutritionDetail,
    //     #[serde(rename = "sodiumContent")]
    //     sodium_content: NutritionDetail,
    //     #[serde(rename = "carbohydrateContent")]
    //     carbohydrate_content: NutritionDetail,
    //     #[serde(rename = "fiberContent")]
    //     fiber_content: NutritionDetail,
    //     #[serde(rename = "sugarContent")]
    //     sugar_content: NutritionDetail,
    //     #[serde(rename = "proteinContent")]
    //     protein_content: NutritionDetail,
    // }

    #[derive(Serialize, Deserialize, Debug)]
    struct NutritionDetail {
        label: String,
        value: String,
        unit: String,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct Monotony {}

    #[derive(Serialize, Deserialize, Debug)]
    struct Schedule {
        date: String,
        cafes: HashMap<String, Menu>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct Menu {
        name: String,
        menu_id: String,
        dayparts: Vec<Vec<DayPart>>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct DayPart {
        id: String,
        starttime: String,
        endtime: String,
        label: String,
        abbreviation: String,
        stations: Vec<Station>,
    }

    #[derive(Serialize, Deserialize, Debug)]
    struct Station {
        order_id: String,
        id: String,
        label: String,
        price: String,
        note: String,
        soup: u8,
        items: Vec<MenuItemId>,
    }
}

struct CafeId {
    id: i32,
}

impl<'r> FromParam<'r> for CafeId {
    type Error = &'r RawStr;

    fn from_param(param: &'r RawStr) -> Result<Self, Self::Error> {
        // ensure that the parameter is numeric
        if !param.chars().all(|c| (c >= '0' && c <= '9')) {
            return Err(param);
        }

        param
            .parse()
            .map(|value| CafeId { id: value })
            .map_err(|_| param)
    }
}

#[get("/food/cafe/<cafe_id>")]
fn cafe(cafe_id: CafeId) -> Option<Json<cafe::Response>> {
    let base = "https://legacy.cafebonappetit.com/api/2/cafes";
    let query = &[("cafe", cafe_id.id.to_string())];

    let url = Url::parse_with_params(base, query);
    // println!("{:?}", url);

    if let Ok(url) = url {
        if let Ok(mut resp) = reqwest::get(url) {
            if let Ok(info) = resp.json::<cafe::Response>() {
                return Some(Json(info));
            }
        }
    }

    None
}

#[get("/food/menu/<cafe_id>")]
fn menu(cafe_id: CafeId) -> Option<Json<menu::Response>> {
    let base = "https://legacy.cafebonappetit.com/api/2/menus";
    let query = &[("cafe", cafe_id.id.to_string())];

    let url = Url::parse_with_params(base, query);
    // println!("{:?}", url);

    if let Ok(url) = url {
        if let Ok(mut resp) = reqwest::get(url) {
            let info: menu::Response = resp.json().expect("foo");
            // if let Ok(info) = resp.json::<menu::Response>() {
            // }
            return Some(Json(info));
        }
    }

    None
}
