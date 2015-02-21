logger = new Logger("displayProject")

Template.displayProject.helpers(
  creationDateString: ->
    moment(@created).format("MMMM Do YYYY")
  userFullName: ->
    @ownerName
  tagsString: ->
    @tags.join(',')
)
