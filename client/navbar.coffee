logger = new Logger("navbar")

timeoutHandle = null

Template.layout.events({
  "input #navbar-search-input": (event) ->
    if timeoutHandle?
      clearTimeout(timeoutHandle)
    timeoutHandle = setTimeout(->
      timeoutHandle = null
      query = trimWhitespace(event.target.value)
      logger.debug("User is searching for '#{query}'")
      Router.go('home', {}, if !S.isBlank(query) then {query: "query=#{query}"} else {})
      event.target.value = ""
    , 500)
})
