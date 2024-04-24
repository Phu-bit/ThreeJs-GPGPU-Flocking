attribute vec2 reference;
attribute float birdVertex;

attribute vec3 birdColor;

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

varying vec4 vColor;
varying float z;
varying float x;
varying float y;
varying float timeFs;
varying vec3 speedFs;
varying vec3 velocityFS;
varying float positionZ;
varying float distanceFromCenter;
varying vec3 birdVertexFs;
varying vec3 cameraPositionFs; 

uniform float time;


void main() {

    vec4 tmpPos = texture2D( texturePosition, reference );
    vec3 pos = tmpPos.xyz;
    vec3 velocity = normalize(texture2D( textureVelocity, reference ).xyz);
    speedFs = velocity;
    velocityFS = velocity;
    positionZ = tmpPos.z;
    distanceFromCenter = normalize(texture2D( textureVelocity, reference ).w);

    vec3 newPosition = position;

    if ( birdVertex == 3.0 ) {
        // flap wings
        newPosition.x = sin( tmpPos.w ) * 5.;
        newPosition += velocity * 0.5;
    }
    if ( birdVertex == 8.0 ) {
        // flap wings
        newPosition.z = -sin( tmpPos.w ) * 5.;
    }
    if ( birdVertex == 9.0) {
        // flap wings
        newPosition.z = sin( tmpPos.w ) * 5.;
    }

    newPosition = mat3( modelMatrix ) * newPosition;


    velocity.z *= -1.;
    float xz = length( velocity.xz );
    float xyz = 1.;
    float x = sqrt( 1. - velocity.y * velocity.y );

    float cosry = velocity.x / xz;
    float sinry = velocity.z / xz;

    float cosrz = x / xyz;
    float sinrz = velocity.y / xyz;

    mat3 maty =  mat3(
        cosry, 0, -sinry,
        0    , 1, 0     ,
        sinry, 0, cosry

    );

    mat3 matz =  mat3(
        cosrz , sinrz, 0,
        -sinrz, cosrz, 0,
        0     , 0    , 1
    );

    newPosition =  maty * matz * newPosition;
    newPosition += pos;

    z = newPosition.z;
    x = newPosition.x;
    y = newPosition.y;

    vColor = vec4( birdColor, 1.0 );
    birdVertexFs = newPosition;
    cameraPositionFs = cameraPosition;
    gl_Position = projectionMatrix *  viewMatrix  * vec4( newPosition, 1.0 );
    timeFs = time; 
}

