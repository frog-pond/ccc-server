#![feature(plugin)]
#![plugin(rocket_codegen)]

extern crate reqwest;
extern crate rocket;
extern crate rocket_contrib;

#[macro_use]
extern crate serde_derive;

use rocket::Rocket;

mod aao;

mod carls;

#[get("/hello/<name>/<age>")]
fn hello_name_age(name: String, age: u8) -> String {
    format!("Hello, {} year old named {}!\n", age, name)
}

#[get("/")]
fn hello_world() -> &'static str {
    "Hello, world!"
}

#[get("/ping")]
fn ping() -> &'static str {
    "pong"
}

#[get("/reqwest")]
fn req() -> reqwest::Result<String> {
    let body = reqwest::get("https://www.rust-lang.org")?.text()?;

    Ok(body)
}

fn rocket() -> Rocket {
    rocket::ignite()
        .mount("/", routes![hello_name_age, hello_world, ping, req])
        .mount("/carls", carls::get_routes())
        .mount("/aao", aao::get_routes())
}

fn main() {
    rocket().launch();
}
