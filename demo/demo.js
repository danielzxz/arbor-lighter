(function() {
  var Renderer = function(canvas){
    var ctx = canvas.getContext("2d")
    var particleSystem = null
    var i=0;
    var that = {
      init:function(system){
        particleSystem = system
        particleSystem.screenSize(canvas.width,canvas.height) // inform the system so it can map coords for us
        particleSystem.screenStep(1); 
        that.redraw()
        that.initMouseHandling()
      },
      redraw:function(){
        if (particleSystem===null) return
        ctx.clearRect(0,0, canvas.width, canvas.height)
        particleSystem.eachNode(canvas.width,ctx,function(node, pt){
          var edges=particleSystem.eachEdge();
          ctx.globalCompositeOperation = "destination-over";
          for (var i = 0; i < edges.length; i++) {
            var ep1=particleSystem.toScreen(edges[i].source.p);
            var ep2=particleSystem.toScreen(edges[i].target.p);
            ctx.strokeStyle = "#C0C0C0"//线段样式
            ctx.lineWidth = 1
            ctx.beginPath();
            ctx.moveTo(ep1.x, ep1.y);
            ctx.lineTo(ep2.x, ep2.y);
            ctx.closePath();
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          ctx.font = "bold 30px Microsoft YaHei";//文字样式
          var w = ctx.measureText(node.data.label).width+0.1*ctx.measureText(node.data.label).width
          var h = w/node.data.label.length+0.3*(w/node.data.label.length)
          var label = node.data.label
          if (!(label||"").match(/^[ \t]*$/)){
            pt.x = Math.floor(pt.x)
            pt.y = Math.floor(pt.y)
          }else{
            label = null
          }
          var x=pt.x
          var y=pt.y
          CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            this.beginPath();
            this.moveTo(x+r, y);
            this.arcTo(x+w, y, x+w, y+h, r);
            this.arcTo(x+w, y+h, x, y+h, r);
            this.arcTo(x, y+h, x, y, r);
            this.arcTo(x, y, x+w, y, r);
            this.closePath();
            return this;
          };
          var c = node.data.class;//节点样式
          if(c=="e"){
            ctx.fillStyle="#DDA0DD"
          } 
          else if(c=="p"){
            ctx.fillStyle="#FFDEAD"
          }
          else{
            ctx.fillStyle="#40E0D0"
          }
          if(x+w/2>canvas.width){
            //console.log("qiantai"+w);
            x=x-w/2
          }
          else if(x-w/2<=0){
            x=x+w/2
          }
          else{
            x=x
          }
          ctx.roundRect(x-w/2,y-h/2,w,h,5).fill();
          ctx.textAlign = "center"
          ctx.textBaseline="middle";
          ctx.fillStyle = "#000000"
          ctx.fillText(label||"", x, y)
        })
      },
      initMouseHandling:function(){
        // no-nonsense drag and drop (thanks springy.js)
        var selected = [];
        canvas.addEventListener(
          "click",
          function(e){
            var pos={x:e.offsetX*2,y:e.offsetY*2};
            var selected = particleSystem.nearest(ctx,pos,canvas.width);
            if (selected!== null){
              console.log(selected[0].data.label+"被选中了！");
            }
          },
          false
        ); 
        canvas.addEventListener(
          "mousemove",
          function(e){
            var pos={x:e.offsetX*2,y:e.offsetY*2};
            var selected = particleSystem.nearest(ctx,pos,canvas.width);
            if (selected!== null){
              canvas.style.cursor="pointer";
            }
            else{
              canvas.style.cursor="default";
            }
          },
          false
        ); 
      }
    }
    return that
  }
  var sys = arbor.ParticleSystem(4000, 500, 0.5, 55)
  var canvas = document.getElementById("viewport")
  sys.renderer = Renderer(canvas)
  $.getJSON("demo.json",function(json){
      var nodes = json.nodes
      $.each(nodes, function(name, info){
      info.label=name
    })
    sys.merge({nodes:nodes, edges:json.edges})
  })
})()