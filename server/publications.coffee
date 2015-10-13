logger = new Logger("publications")

Meteor.publish("projects", -> Projects.find())
Meteor.publish("filteredProjects", (query) ->
  selector = {}
  sort = undefined
  if !S.isBlank(query)
    logger.debug("Filtering projects according to query:", query)
    reTag = /\[[^\]]*\]/g
    queryWithoutTags = ""
    tags = []
    offset = 0
    while true
      m = reTag.exec(query)
      if !m?
        break

      logger.debug("Found tag '#{tag}'")
      tag = trimWhitespace(m[0][1...-1])
      tags.push(tag)
      queryWithoutTags += " " + query[offset...m.index]
      offset = reTag.lastIndex

    queryWithoutTags += " " + query[offset..]
    queryWithoutTags = trimWhitespace(queryWithoutTags.replace(/\s+/g, " "))

    logger.debug("Filtering projects")
    if !S.isBlank(queryWithoutTags)
      logger.debug("Query: '#{queryWithoutTags}'")
      selector.$text = {"$search": queryWithoutTags}
      sort = {
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
    if !R.isEmpty(tags)
      logger.debug("Tags:", tags)
      selector.tags = {$all: tags}
    else
      logger.debug("No tags")
  Projects.find(selector, sort)
)
Meteor.publish("users", -> Meteor.users.find())
Meteor.publish("trelloBoards", -> TrelloBoards.find())
