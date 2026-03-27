export default interface Room {
    type: number;
    walls: { type: string; position: string }[];
    petId?: string;
}
