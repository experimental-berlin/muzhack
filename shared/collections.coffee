@Projects = new Mongo.Collection("projects")
if Meteor.isServer
  Projects._ensureIndex({
    "owner": "text"
    "projectId": "text"
    "title": "text"
    "description": "text"
    "instructions": "text"
  })
@TrelloBoards = new Mongo.Collection("trelloBoards")
