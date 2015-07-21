//
//  arbor.js - version 0.91
//  a graph vizualization toolkit
//
{{LICENSE}}
(function(){
  {{DEPS}}
  arbor = (typeof(arbor)!=='undefined') ? arbor : {}
  $.extend(arbor, {
    // object constructors (don't use ‘new’, just call them)
    ParticleSystem:ParticleSystem,
    Point:function(x, y){ return new Point(x, y) }
  })
})()