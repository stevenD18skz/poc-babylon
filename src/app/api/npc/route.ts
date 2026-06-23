import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { currentAction = 'idle', position = { x: 0, y: 0, z: 0 } } = body;

        // Simulamos un procesamiento de "IA" en servidor con latencia variable
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600));

        let nextAction = 'idle';
        let targetX = position.x;
        let targetZ = position.z;

        // Máquina de estados probabilística simple pero más realista
        const rand = Math.random();

        if (currentAction === 'idle') {
            if (rand < 0.6) {
                nextAction = 'walk'; // Muchas ganas de explorar
            } else if (rand < 0.8) {
                nextAction = 'jump'; // A veces salta
            } else {
                nextAction = 'idle'; // Se queda quieto
            }
        } else if (currentAction === 'walk') {
            if (rand < 0.5) {
                nextAction = 'idle'; // Se cansa
            } else {
                nextAction = 'walk'; // Sigue caminando
            }
        } else if (currentAction === 'jump') {
            // Después de saltar, siempre descansa o camina
            if (rand < 0.7) {
                nextAction = 'idle';
            } else {
                nextAction = 'walk';
            }
        }

        // Si decide caminar, calculamos un nuevo objetivo lógico y cercano a su posición
        if (nextAction === 'walk') {
            const angle = Math.random() * Math.PI * 2;
            const distance = 2 + Math.random() * 6; // radio de 2 a 8 unidades
            
            targetX = position.x + Math.cos(angle) * distance;
            targetZ = position.z + Math.sin(angle) * distance;

            // Mantener al NPC dentro del corral (Paddock es aprox 20x20, de -10 a 10)
            targetX = Math.max(-9, Math.min(9, targetX));
            targetZ = Math.max(-9, Math.min(9, targetZ));
        }

        return NextResponse.json({
            action: nextAction,
            targetPosition: { x: targetX, z: targetZ },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error in NPC AI:", error);
        return NextResponse.json({ action: 'idle' }, { status: 500 });
    }
}