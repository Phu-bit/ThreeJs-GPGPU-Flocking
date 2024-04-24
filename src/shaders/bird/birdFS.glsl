varying vec4 vColor;
varying float z;
varying float y;
varying float x;
varying float timeFs;
varying vec3 speedFs;
varying vec3 velocityFS;
varying float positionZ;
varying float distanceFromCenter;
varying vec3 birdVertexFs;



uniform vec3 color;

float getFogFactor(float d)
{
    const float FogMax = 50.0;
    const float FogMin = 20.0;

    if (d>=FogMax) return 1.0;
    if (d<=FogMin) return 0.0;

    return 1.0 - (FogMax - d) / (FogMax - FogMin);
}


void main() {

    //interesting dark mode
    // float maxDist = sqrt(pow(300.0, 2.0) + pow(300.0, 2.0)); // Example for a 1000x1000 screen
    // float normalizedDist = distToMouse / maxDist;

    // float darkeningFactor = 1.0 - normalizedDist; // Inversely proportional to distance
    // vec3 adjustedColor = vec3(color.x * darkeningFactor, color.y * darkeningFactor, color.z * darkeningFactor);

    // gl_FragColor = vec4(adjustedColor, 1.0); // Ensure alpha is 1.0 for full opacity

    //attemping something
    // Fake colors for now
    float z1 = (0.0 + ( 1000. - z ) / 1000. * vColor.x);
    float z2 = (0.3 + ( 1000. - z ) / 1000. * vColor.y);
    float z3 = (0.3 + ( 1000. - z ) / 1000. * vColor.z);
    // gl_FragColor = vec4( z1, z1, z1, 1. );
    // gl_FragColor = vec4( velocityFS.xy,(z3), distanceFromCenter );
    float d = distance(cameraPosition, birdVertexFs);
    float alpha = getFogFactor(d);
    vec4 foggedColor = mix( vec4( velocityFS.xy,(z3), distanceFromCenter), vec4( z1, z2, z3, 1. ), alpha);
    gl_FragColor = mix(foggedColor,vec4( velocityFS.xy,(z3), alpha ), distanceFromCenter);
    // gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    // gl_FragColor = vec4( vec3(distanceFromCenter/3.), 1.0 );

}
