# arbor-lighter.js

Arbor-lighter is a graph visualization library base on Arbor.js by samizdatco.
Here, I want to thank the original author samizdatco.
Arbor-lighter has been carried out on the basis of the original many changes.
Remove JQuery worker and tween,in addition I let the program support HD resolution.
After compression, the code size is only 20KB.

## Installation

To use the arber-lighter, add the file at lib/arbor.js
to your path somewhere and include them in your html:
```html
<script src="path/to/arbor.js"></script>  
```

## Getting Started

In addition, the demos folder contains a simple example. 
But since all of them use xhr to fetch their data, you'll 
still need to view them from an http server. 
If you don't have a copy of
apache handy, use the demo-server.sh script to create a local server.

## Colophon

Arbor-lighter is base on Arbor.js.
Arbor’s design is heavily influenced by Jeffrey Bernstein’s excellent
Traer Physics[1] library for Processing. In addition, much of the
physics code has been adapted from Dennis Hotson’s springy.js[2]. The
Barnes-Hut n-body implementation is based on Tom Ventimiglia and Kevin 
Wayne’s vivid description[3] of the algorithm.

Thanks to all for releasing such elegantly simple and comprehensible
code.

1. <http://murderandcreate.com/physics/>
2. <https://github.com/dhotson/springy>
3. <http://arborjs.org/docs/barnes-hut>

## Contribute

Code submissions are greatly appreciated and highly encouraged. Please send
pull requests with fixes/enhancements/etc. to danielzxz on github. 

## License

Arbor-lighter is released under the MIT license. http://en.wikipedia.org/wiki/MIT_License