logger = new Logger("SearchService")

class @SearchService
  search: (query) ->
    query = trimWhitespace(query)
    logger.info("Performing search '#{query}'")
    Router.go("home", {}, if !S.isBlank(query) then {query: "query=#{query}"} else {})
