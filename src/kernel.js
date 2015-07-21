//
// kernel.js
//
// run-loop manager for physics and tween updates
//
    
  var Kernel = function(pSystem){
    // in chrome, web workers aren't available to pages with file:// urls
    var chrome_local_file = window.location.protocol == "file:" &&
                            navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    //var USE_WORKER = false//(window.Worker !== undefined && !chrome_local_file)    
    
    var _physics = null
    var _tween = null
    var _fpsWindow = [] // for keeping track of the actual frame rate
    _fpsWindow.last = new Date()
    var _screenInterval = null
    var _attached = null

    var _tickInterval = null
    var _lastTick = null
    var _paused = false
    
    var that = {
      system:pSystem,
      tween:null,
      nodes:{},

      init:function(){
        if (typeof(Tween)!='undefined') _tween = Tween()
        else if (typeof(arbor.Tween)!='undefined') _tween = arbor.Tween()
        else _tween = {busy:function(){return false},
                       tick:function(){return true},
                       to:function(){ _tween.to=function(){}; return} }
        that.tween = _tween
        var params = pSystem.parameters()

        
        _physics = Physics(params.dt, params.stiffness, params.repulsion, params.friction, that.system._updateGeometry, params.integrator)
        that.start()

        return that
      },

      //
      // updates from the ParticleSystem
      graphChanged:function(changes){
        // a node or edge was added or deleted

        _physics._update(changes)
        that.start() // <- is this just to kick things off in the non-worker mode? (yes)
      },




      

      _lastPositions:null,

      

      // 
      // the main render loop when running in web worker mode
      _lastFrametime:new Date().valueOf(),
      _lastBounds:null,
      _currentRenderer:null,


      // 
      // the main render loop when running in non-worker mode
      physicsUpdate:function(){

        //if (_tween) _tween.tick()
        _physics.tick()
        var stillActive = that.system._updateBounds()
        if (_tween && _tween.busy()) stillActive = true

        var render = that.system.renderer
        var now = new Date()        
        var render = that.system.renderer
        if (render!==undefined){
          if (render !== _attached){
            render.init(that.system)
            _attached = render
          }          
          render.redraw({timestamp:now})
        }

        var prevFrame = _fpsWindow.last
        _fpsWindow.last = now
        _fpsWindow.push(_fpsWindow.last-prevFrame)
        if (_fpsWindow.length>50) _fpsWindow.shift()

        // but stop the simulation when energy of the system goes below a threshold
        var sysEnergy = _physics.systemEnergy()
        if ((sysEnergy.mean + sysEnergy.max)/2 < 0.05){
          if (_lastTick===null) _lastTick=new Date().valueOf()
          if (new Date().valueOf()-_lastTick>1000){
            // trace('stopping')
            clearInterval(_tickInterval)
            _tickInterval = null
          }else{
            // trace('pausing')
          }
        }else{
          // trace('continuing')
          _lastTick = null
        }
      },




      // 
      // start/stop simulation
      // 
      start:function(unpause){
      	if (_tickInterval !== null) return; // already running
        if (_paused && !unpause) return; // we've been .stopped before, wait for unpause
        _paused = false
        
        _lastTick = null
        _tickInterval = setInterval(that.physicsUpdate, that.system.parameters().timeout)
      },
      stop:function(){
        _paused = true
          if (_tickInterval!==null){
            clearInterval(_tickInterval)
            _tickInterval = null
        }
      
      }
    }
    
    return that.init()    
  }
  