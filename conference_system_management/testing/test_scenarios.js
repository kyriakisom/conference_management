import request from 'supertest';
import makeApp from "../app.js";

const app = makeApp();

// Test data for user registration
const data = {
    firstName: "testingFirstname",
    lastName: "testingSurname",
    username: "testingUsername",
    password: "1234",
    role: "author"
};

// Test data for user login
const loginData ={
    username:"pc chair",
    password:"1234"
};

// Test data for connecting as a visitor
const connect_as_visitorData ={
    username:"null",
    password:"null",
    role:"visitor"
};

// Test data for creating a paper
const PaperData = {
    title:"testPaperTitle",    
    abstract:"testPaperAbstract",
    content:"testPaperContent",
    authors:["testPaperAuthors"],
    coauthors:["testPaperCoAuthors"],
    reviewers:["testPaperReviewers"],
};

// Test data for creating a conference
const ConferenceData ={   
    name:"testConferenceName",
    description:"testConferenceDescription",
    pcChairs :["testConferencePcChairs"] ,
    pcMembers :["testConferencePcMembers"] 
};

// Test data for creating a review
const ReviewData ={   
    paper:"testReviewPaper",
    reviewer:"testReviewReviewer",
    score :["testReviewScore"] ,
    justification :["testReviewJustification"] 
};

// Variables to store user and paper IDs, and token
var user_id ;
var token;
var paper_id;
var conference_id;

// Test registration functionality
test("Registration is done correctly", async () => {
    var response =  await request(app).post("/users/signup")
        .send(data);
  
    expect(response.body.message).toBe("registration done");
    expect(response.status).toBe(201);
    user_id =  response.body.user_id;
});

// Test login functionality
test("Login is done correctly", async () => {
    var response = await request(app).post("/users/login")
        .send(loginData);

    token =  response.body.accessToken;
    expect(response.status).toBe(200);
});

// Test creating papers functionality
test("Creating papers is done correctly", async () => {
    var response = await request(app).post("/papers/")
        .send(PaperData)
        .set('Authorization', 'Bearer ' + token);

    expect(response.body.message).toBe("paper created");
    expect(response.status).toBe(201);

    paper_id =  response.body.paper_id;
});