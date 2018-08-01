use rocket::Route;

#[get("/")]
fn hello_world() -> &'static str {
    "Hello, Carleton!"
}

pub fn get_routes() -> Vec<Route> {
    routes![hello_world]
}
