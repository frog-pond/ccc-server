use rocket::Route;

mod food;

#[get("/")]
fn hello_world() -> &'static str {
    "Hello, St. Olaf!"
}

pub fn get_routes() -> Vec<Route> {
    routes![hello_world, food::cafe, food::menu]
}
