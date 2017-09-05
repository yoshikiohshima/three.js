uniform vec3 color;
uniform float opacity;

#if defined(NEEDSGLSL300)
out vec4 glFragColor;
#endif


#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

void main() {

#if defined(NEEDSGLSL300)
	glFragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
#else
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
#endif
}
