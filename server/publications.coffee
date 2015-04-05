Meteor.publish("projects", -> Projects.find())
Meteor.publish("licenses", -> Licenses.find())
Meteor.publish("users", -> Meteor.users.find())
