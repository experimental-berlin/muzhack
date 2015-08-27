Meteor.publish("projects", -> Projects.find())
Meteor.publish("filteredProjects", (query) ->
  params = if S.isBlank(query) then {} else [
    {"$text": {"$search": query}}
    {
      # Project each document to include a property named 'score', which contains the document's
      # search rank
      fields: {
        score: { $meta: "textScore" }
      }
      # Indicates that we wish the publication to be sorted by document score
      sort: {
        score: { $meta: "textScore" }
      }
    }
  ]
  Projects.find(params...)
)
Meteor.publish("users", -> Meteor.users.find())
Meteor.publish("trelloBoards", -> TrelloBoards.find())
