logger = new Logger("explore")

Template.explore.helpers({
  isEmpty: ->
    !Projects.findOne()
  ,
  projects: ->
    Projects.find()
})

Template.explore.rendered = ->
  logger.debug("Initializing Isotope")
  $("#isotope-container").isotope({
    itemSelector: ".project-item",
    layoutMode: 'fitRows',
  })
