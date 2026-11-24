export const STATIC_MODELS = [
    {
        path: 'models/Oscillator.glb',
        position: { x: 0, z: -6.0 },
        scale: 3,
        terminals: [
            { snap: 'oscilloscope', names: ['CH1_INPUT', 'CH2_INPUT', 'TRIG_INPUT'] },
        ],
    },
    {
        path: 'models/RLC.glb',
        position: { x: 0, z: 4.5 },
        scale: 3,
        terminals: [
            {
                snap: 'rlc', names: [
                    'C_Black_Clemma', 'C_Red_Clemma',
                    'Input_Black_Clemma', 'Input_Red_Clemma',
                    'L_Black_Clemma', 'L_Red_Clemma',
                    'Output_Black_Clemma', 'Output_Red_Clemma',
                    'R_Black_Clemma', 'R_Red_Clemma',
                ]
            },
        ],
    },
    {
        path: 'models/Dynamic.glb',
        position: { x: 9.0, z: 3.0 },
        scale: 3,
        terminals: [
            { snap: 'speaker', names: ['Black_Clemma', 'Red_Clemma'] },
        ],
    },
];