Meteor.publish("projects", -> Projects.find())
Meteor.publish("users", -> Meteor.users.find())
Meteor.publish("trelloBoards", -> TrelloBoards.find())
