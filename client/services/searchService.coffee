logger = new Logger("SearchService")

class @SearchService
  search: (query) ->
    query = trimWhitespace(query)
    logger.info("Performing search '#{query}'")
    Router.go("home", {}, {query: "query=#{query}"})
