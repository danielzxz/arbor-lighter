//
// system.js
//
// the main controller object for creating/modifying graphs 
//

  var ParticleSystem = function(repulsion, stiffness, friction, centerGravity, targetFps, dt, precision, integrator){
  // also callable with ({integrator:, stiffness:, repulsion:, friction:, timestep:, fps:, dt:, gravity:})
    var _changes=[]
    var _notification=null
    var _epoch = 0

    var _screenSize = null
    var _screenStep = .04
    var _screenPadding = [20,20,20,20]
    var _bounds = null
    var _boundsTarget = null

    

    if (typeof repulsion=='object'){
      var _p = repulsion
      friction = _p.friction
      repulsion = _p.repulsion
      targetFps = _p.fps
      dt = _p.dt
      stiffness = _p.stiffness
      centerGravity = _p.gravity
      precision = _p.precision
      integrator = _p.integrator
    }

    // param validation and defaults
    if (integrator!='verlet' && integrator!='euler') integrator='verlet'
    friction = isNaN(friction) ? .5 : friction
    repulsion = isNaN(repulsion) ? 1000 : repulsion
    targetFps = isNaN(targetFps) ? 55 : targetFps
    stiffness = isNaN(stiffness) ? 600 : stiffness
    dt = isNaN(dt) ? 0.02 : dt
    precision = isNaN(precision) ? .6 : precision
    centerGravity = (centerGravity===true)

    var _systemTimeout = 0
    var _parameters = {integrator:integrator, repulsion:repulsion, stiffness:stiffness, friction:friction, dt:dt, gravity:centerGravity, precision:precision, timeout:_systemTimeout}
    var _energy

    var state = {
      renderer:null, // this is set by the library user
      tween:null, // gets filled in by the Kernel
      nodes:{}, // lookup based on node _id's from the worker
      edges:{}, // likewise
      adjacency:{}, // {name1:{name2:{}, name3:{}}}
      names:{}, // lookup table based on 'name' field in data objects
      kernel: null
    }

    var static_xy=[];

    var isSame=function(obj1,obj2){
      if(obj1.length!=obj2.length) return false;
      for (var i = 0; i < obj1.length; i++) {
        if(obj1[i].x!=obj2[i].x||obj1[i].y!=obj2[i].y){
          return false;
        }
      }
      return true;
    }

    var that={
      parameters:function(newParams){

        if (newParams!==undefined){
          if (!isNaN(newParams.precision)){
            newParams.precision = Math.max(0, Math.min(1, newParams.precision))
          }
          $.each(_parameters, function(p, v){
            if (newParams[p]!==undefined) _parameters[p] = newParams[p]
          })
          state.kernel.physicsModified(newParams)
        }
        return _parameters
      },


      stop:function(){
        state.kernel.stop()
      },

      addNode:function(name, data){
        data = data || {}
        var priorNode = state.names[name]
        if (priorNode){
          priorNode.data = data
          return priorNode
        }else if (name!=undefined){
          // the data object has a few magic fields that are actually used
          // by the simulation:
          //   'mass' overrides the default of 1
          //   'fixed' overrides the default of false
          //   'x' & 'y' will set a starting position rather than 
          //             defaulting to random placement
          var x = (data.x!=undefined) ? data.x : null
          var y = (data.y!=undefined) ? data.y : null
          var fixed = (data.fixed) ? 1 : 0

          var node = new Node(data)
          node.name = name
          state.names[name] = node
          state.nodes[node._id] = node;

          _changes.push({t:"addNode", id:node._id, m:node.mass, x:x, y:y, f:fixed})
          that._notify();
          return node;

        }
      },



      getNode:function(nodeOrName){
        if (nodeOrName._id!==undefined){
          return nodeOrName
        }else if (typeof nodeOrName=='string' || typeof nodeOrName=='number'){
          return state.names[nodeOrName]
        }
        // otherwise let it return undefined
      },

      eachNode:function(width,ctx,callback){
        var move_xy=[];
        $.each(state.nodes,function(id,n){
          if (n._p.x==null || n._p.y==null) return
          var pt = (_screenSize!==null) ? that.toScreen(n._p) : n._p
          var w = ctx.measureText(n.data.label||"").width
          var x=Math.floor(pt.x),y=Math.floor(pt.y)
          move_xy.push({x:x,y:y});
        });
        if(isSame(static_xy,move_xy)){
          $.each(state.nodes,function(id,n){
            if (n._p.x==null || n._p.y==null) return
            var pt = (_screenSize!==null) ? that.toScreen(n._p) : n._p
            callback.call(that, n, pt);
            that.stop();
          });
        }
        else{
          static_xy=[];
          $.each(state.nodes, function(id, n){
            if (n._p.x==null || n._p.y==null) return
            var pt = (_screenSize!==null) ? that.toScreen(n._p) : n._p
            var w = ctx.measureText(n.data.label||"").width
            var x=Math.floor(pt.x),y=Math.floor(pt.y)
            static_xy.push({x:x,y:y});
            callback.call(that, n, pt);
          })
        }
      },

      addEdge:function(source, target, data){
        source = that.getNode(source) || that.addNode(source)
        target = that.getNode(target) || that.addNode(target)
        data = data || {}
        var edge = new Edge(source, target, data);

        var src = source._id
        var dst = target._id
        state.adjacency[src] = state.adjacency[src] || {}
        state.adjacency[src][dst] = state.adjacency[src][dst] || []

        var exists = (state.adjacency[src][dst].length > 0)
        if (exists){
          // probably shouldn't allow multiple edges in same direction
          // between same nodes? for now just overwriting the data...
          $.extend(state.adjacency[src][dst].data, edge.data)
          return
        }else{
          state.edges[edge._id] = edge
          state.adjacency[src][dst].push(edge)
          var len = (edge.length!==undefined) ? edge.length : 1
          _changes.push({t:"addSpring", id:edge._id, fm:src, to:dst, l:len})
          that._notify()
        }

        return edge;

      },



      // find the edges from node1 to node2
      getEdges:function(node1, node2) {
        node1 = that.getNode(node1)
        node2 = that.getNode(node2)
        if (!node1 || !node2) return []
        
        if (typeof(state.adjacency[node1._id]) !== 'undefined'
          && typeof(state.adjacency[node1._id][node2._id]) !== 'undefined'){
          return state.adjacency[node1._id][node2._id];
        }

        return [];
      },


      eachEdge:function(){
        var nodeEdges = []
        $.each(state.edges, function(edgeId, edge){
          nodeEdges.push(edge)
        })
        return nodeEdges;
      },


      prune:function(callback){
        // callback should be of the form ƒ(node, {from:[],to:[]})
        var changes = {dropped:{nodes:[], edges:[]}}
        if (callback===undefined){
          $.each(state.nodes, function(id, node){
            changes.dropped.nodes.push(node)
            that.pruneNode(node)
          })
        }else{
          that.eachNode(function(node){
            var drop = callback.call(that, node, {from:that.getEdgesFrom(node), to:that.getEdgesTo(node)})
            if (drop){
              changes.dropped.nodes.push(node)
              that.pruneNode(node)
            }
          })
        }
        // trace('prune', changes.dropped)
        return changes
      },
      
      graft:function(branch){
        // branch is of the form: { nodes:{name1:{d}, name2:{d},...}, 
        //                          edges:{fromNm:{toNm1:{d}, toNm2:{d}}, ...} }

        var changes = {added:{nodes:[], edges:[]}}
        if (branch.nodes) $.each(branch.nodes, function(name, nodeData){
          var oldNode = that.getNode(name)
          // should probably merge any x/y/m data as well...
          // if (oldNode) $.extend(oldNode.data, nodeData)
          
          if (oldNode) oldNode.data = nodeData
          else changes.added.nodes.push( that.addNode(name, nodeData) )
          
          state.kernel.start()
        })
        
        if (branch.edges) $.each(branch.edges, function(src, dsts){
          var srcNode = that.getNode(src)
          if (!srcNode) changes.added.nodes.push( that.addNode(src, {}) )

          $.each(dsts, function(dst, edgeData){

            // should probably merge any x/y/m data as well...
            // if (srcNode) $.extend(srcNode.data, nodeData)


            // i wonder if it should spawn any non-existant nodes that are part
            // of one of these edge requests...
            var dstNode = that.getNode(dst)
            if (!dstNode) changes.added.nodes.push( that.addNode(dst, {}) )

            var oldEdges = that.getEdges(src, dst)
            if (oldEdges.length>0){
              // trace("update",src,dst)
              oldEdges[0].data = edgeData
            }else{
            // trace("new ->",src,dst)
              changes.added.edges.push( that.addEdge(src, dst, edgeData) )
            }
          })
        })

        // trace('graft', changes.added)
        return changes
      },

      merge:function(branch){
        var changes = {added:{nodes:[], edges:[]}, dropped:{nodes:[], edges:[]}}

        $.each(state.edges, function(id, edge){
          // if ((branch.edges[edge.source.name]===undefined || branch.edges[edge.source.name][edge.target.name]===undefined) &&
          //     (branch.edges[edge.target.name]===undefined || branch.edges[edge.target.name][edge.source.name]===undefined)){
          if ((branch.edges[edge.source.name]===undefined || branch.edges[edge.source.name][edge.target.name]===undefined)){
                that.pruneEdge(edge)
                changes.dropped.edges.push(edge)
              }
        })
        
        var prune_changes = that.prune(function(node, edges){
          if (branch.nodes[node.name] === undefined){
            changes.dropped.nodes.push(node)
            return true
          }
        })
        var graft_changes = that.graft(branch)        
        changes.added.nodes = changes.added.nodes.concat(graft_changes.added.nodes)
        changes.added.edges = changes.added.edges.concat(graft_changes.added.edges)
        changes.dropped.nodes = changes.dropped.nodes.concat(prune_changes.dropped.nodes)
        changes.dropped.edges = changes.dropped.edges.concat(prune_changes.dropped.edges)
        
        // trace('changes', changes)
        return changes
      },

      




      _updateGeometry:function(e){
        if (e != undefined){          
          var stale = (e.epoch<_epoch)

          _energy = e.energy
          var pts = e.geometry // an array of the form [id1,x1,y1, id2,x2,y2, ...]
          if (pts!==undefined){
            for (var i=0, j=pts.length/3; i<j; i++){
              var id = pts[3*i]
                            
              // canary silencer...
              if (stale && state.nodes[id]==undefined) continue
              
              state.nodes[id]._p.x = pts[3*i + 1]
              state.nodes[id]._p.y = pts[3*i + 2]
            }
          }          
        }
      },
      

      
      screenSize:function(canvasWidth, canvasHeight){
        _screenSize = {width:canvasWidth,height:canvasHeight}
        //that._updateBounds()
      },


      screenStep:function(stepsize){
        _screenStep = stepsize
      },

      toScreen:function(p) {
        if (!_bounds || !_screenSize) return
        // trace(p.x, p.y)

        var _padding = _screenPadding || [0,0,0,0]
        var size = _bounds.bottomright.subtract(_bounds.topleft)
        var sx = _padding[3] + p.subtract(_bounds.topleft).divide(size.x).x * (_screenSize.width - (_padding[1] + _padding[3]))
        var sy = _padding[0] + p.subtract(_bounds.topleft).divide(size.y).y * (_screenSize.height - (_padding[0] + _padding[2]))

        // return arbor.Point(Math.floor(sx), Math.floor(sy))
        return arbor.Point(sx, sy)
      },
      fromScreen:function(s) {
        if (!_bounds || !_screenSize) return

        var _padding = _screenPadding || [0,0,0,0]
        var size = _bounds.bottomright.subtract(_bounds.topleft)
        var px = (s.x-_padding[3]) / (_screenSize.width-(_padding[1]+_padding[3]))  * size.x + _bounds.topleft.x
        var py = (s.y-_padding[0]) / (_screenSize.height-(_padding[0]+_padding[2])) * size.y + _bounds.topleft.y

        return arbor.Point(px, py);
      },


      _updateBounds:function(newBounds){
        // step the renderer's current bounding box closer to the true box containing all
        // the nodes. if _screenStep is set to 1 there will be no lag. if _screenStep is
        // set to 0 the bounding box will remain stationary after being initially set 
        if (_screenSize===null) return
        
        if (newBounds) _boundsTarget = newBounds
        else _boundsTarget = that.bounds()
        
        // _boundsTarget = newBounds || that.bounds()
        // _boundsTarget.topleft = new Point(_boundsTarget.topleft.x,_boundsTarget.topleft.y)
        // _boundsTarget.bottomright = new Point(_boundsTarget.bottomright.x,_boundsTarget.bottomright.y)

        var bottomright = new Point(_boundsTarget.bottomright.x, _boundsTarget.bottomright.y)
        var topleft = new Point(_boundsTarget.topleft.x, _boundsTarget.topleft.y)
        var dims = bottomright.subtract(topleft)
        var center = topleft.add(dims.divide(2))


        var MINSIZE = 4                                   // perfect-fit scaling
        // MINSIZE = Math.max(Math.max(MINSIZE,dims.y), dims.x) // proportional scaling

        var size = new Point(Math.max(dims.x,MINSIZE), Math.max(dims.y,MINSIZE))
        _boundsTarget.topleft = center.subtract(size.divide(2))
        _boundsTarget.bottomright = center.add(size.divide(2))

        if (!_bounds){
          if ($.isEmptyObject(state.nodes)) return false
          _bounds = _boundsTarget
          return true
        }
        
        // var stepSize = (Math.max(dims.x,dims.y)<MINSIZE) ? .2 : _screenStep
        var stepSize = 1
        _newBounds = {
          bottomright: _bounds.bottomright.add( _boundsTarget.bottomright.subtract(_bounds.bottomright).multiply(stepSize) ),
          topleft: _bounds.topleft.add( _boundsTarget.topleft.subtract(_bounds.topleft).multiply(stepSize) )
        }
        
        // return true if we're still approaching the target, false if we're ‘close enough’
        var diff = new Point(_bounds.topleft.subtract(_newBounds.topleft).magnitude(), _bounds.bottomright.subtract(_newBounds.bottomright).magnitude())        
        if (diff.x*_screenSize.width>1 || diff.y*_screenSize.height>1){
          _bounds = _newBounds
          return true
        }else{
         return false        
        }
      },

      bounds:function(){
        //console.log("!!!!");
        //  TL   -1
        //     -1   1
        //        1   BR
        var bottomright = null
        var topleft = null

        // find the true x/y range of the nodes
        $.each(state.nodes, function(id, node){
          if (!bottomright){
            bottomright = new Point(node._p)
            topleft = new Point(node._p)
            return
          }
        
          var point = node._p
          if (point.x===null || point.y===null) return
          if (point.x > bottomright.x) bottomright.x = point.x;
          if (point.y > bottomright.y) bottomright.y = point.y;          
          if   (point.x < topleft.x)   topleft.x = point.x;
          if   (point.y < topleft.y)   topleft.y = point.y;
        })


        // return the true range then let to/fromScreen handle the padding
        if (bottomright && topleft){
          ////console.log(bottomright.x+"|"+bottomright.y+" "+topleft.x+"|"+topleft.y);
          return {bottomright: bottomright, topleft: topleft}
        }else{
          //console.log(new Point(-1,-1)+"|"+new Point(1,1));
          return {topleft: new Point(-1,-1), bottomright: new Point(1,1)};
        }
      },

      _notify:function() {
        // pass on graph changes to the physics object in the worker thread
        // (using a short timeout to batch changes)
        if (_notification===null) _epoch++
        else clearTimeout(_notification)
        
        _notification = setTimeout(that._synchronize,20)
        // that._synchronize()
      },
      _synchronize:function(){
        if (_changes.length>0){
          state.kernel.graphChanged(_changes)
          _changes = []
          _notification = null
        }
      },
      nearest:function(ctx,pos,width){
        var selected=[];
        $.each(state.nodes, function(id, node){
          var pt = that.toScreen(node._p)
          if (pt.x===null || pt.y===null) return
          var w=ctx.measureText(node.data.label).width;
          var h=w/node.data.label.length+0.5*(w/node.data.label.length);
          //console.log(node.data.label+"的x坐标为："+pt.x);
          //console.log(pos.x,pt.x+w/2,pt.x-w/2,pos.y,pt.y+h/2,pt.y-h/2);
          if(pt.x+w>width){
            pt.x=pt.x-w/2
          }
          else if(pt.x-w/2<=0){
            pt.x=pt.x+w/2
          }
          else{
            pt.x=pt.x
          }
          if(pos.x<pt.x+(w/2+0.5*w/2)&&pos.x>pt.x-(w/2+0.5*w/2)&&pos.y<pt.y+(h/2+0.3*h/2)&&pos.y>pt.y-(h/2+0.3*h/2)){
            selected.push(node);
          }
        })
        if(selected.length!=0){
          return selected;
        }
        else{
          return null;
        }
      },
    }    
    
    state.kernel = Kernel(that)
    state.tween = state.kernel.tween || null
    
    // some magic attrs to make the Node objects phone-home their physics-relevant changes
    Node.prototype.__defineGetter__("p", function() { 
      var self = this
      var roboPoint = {}
      roboPoint.__defineGetter__('x', function(){ return self._p.x; })
      roboPoint.__defineSetter__('x', function(newX){ state.kernel.particleModified(self._id, {x:newX}) })
      roboPoint.__defineGetter__('y', function(){ return self._p.y; })
      roboPoint.__defineSetter__('y', function(newY){ state.kernel.particleModified(self._id, {y:newY}) })
      roboPoint.__proto__ = Point.prototype
      return roboPoint
    })
    Node.prototype.__defineSetter__("p", function(newP) { 
      this._p.x = newP.x
      this._p.y = newP.y
      state.kernel.particleModified(this._id, {x:newP.x, y:newP.y})
    })

    Node.prototype.__defineGetter__("mass", function() { return this._mass; });
    Node.prototype.__defineSetter__("mass", function(newM) { 
      this._mass = newM
      state.kernel.particleModified(this._id, {m:newM})
    })

    Node.prototype.__defineSetter__("tempMass", function(newM) { 
      state.kernel.particleModified(this._id, {_m:newM})
    })
      
    Node.prototype.__defineGetter__("fixed", function() { return this._fixed; });
    Node.prototype.__defineSetter__("fixed", function(isFixed) { 
      this._fixed = isFixed
      state.kernel.particleModified(this._id, {f:isFixed?1:0})
    })
    
    return that
  }
  