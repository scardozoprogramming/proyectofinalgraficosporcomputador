# Proyecto Final Graficos Por Computador
Miembro: Santiago Cardozo - scardozoprogramming
Profesor: Miguel Fernandez

# Tema
Iluminación avanzada y atmósfera: de Phong a Spotlight, Toon y Niebla en una escena interactiva

# Escena
La escena consiste en un mini diorama 3D, representado como una calle o escenario simple. En ella se utiliza una luz principal, similar a una farola o foco, implementada mediante un spotlight, con una atenuación realista de la luz en función de la distancia.
Para reforzar la sensación de profundidad se incluye un efecto de niebla (fog).
Los objetos del escenario presentan materiales distintos, como metal, plástico o superficies mate. Además, se incorpora un objeto con doble cara (por ejemplo un cartel o tela) que utiliza un material diferente en cada lado. Como alternativa estética, la escena permite activar un modo Toon shader, de estilo ilustrado, para comparar distintos enfoques visuales.

# Qué demuestra (investigación e implementación)

## Investigación
El proyecto analiza la diferencia entre el sombreado Gouraud, donde la iluminación se calcula por vértice, y el sombreado Phong, donde se calcula por fragmento, destacando la relación entre calidad visual y coste computacional.
También se compara el modelo Blinn-Phong con el Phong clásico, explicando el uso del half-vector y su posible mayor eficiencia.
Se estudia el efecto de la atenuación constante, lineal y cuadrática sobre el realismo de la iluminación, así como el funcionamiento del spotlight, incluyendo el cono de luz, el cutoff y el suavizado del borde.
Finalmente, se analiza el uso de niebla y la diferencia entre flat shading y sombreado suave, y su impacto en el estilo visual.

# Implementación
La escena es interactiva y permite alternar los distintos modos mediante controles de teclado. Se puede cambiar entre Gouraud, Phong por fragmento y Blinn-Phong, activar o desactivar el spotlight, la niebla y el modo Toon, así como alternar entre proyección perspectiva y ortográfica.
La cámara utiliza un sistema lookAt con movimiento simple, permitiendo orbitar alrededor de la escena para observar los efectos desde diferentes puntos de vista.

# Controles por teclado/UI para alternar:
1 = Gouraud 
2 = Phong por fragmento
3 = Blinn-Phong 
4 = Spotlight ON/OFF 
5 = Fog ON/OFF 
6 = Toon ON/OFF 
P = proyección Perspectiva/Ortográfica 
Cámara con lookAt + movimiento simple (orbitar o WASD).
