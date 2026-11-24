import torch
from torch import nn

# Bidirectional training objectives share text embeddings. Each call processes
# one utterance, so there are no padded frames in attention or regression loss.
class Translator(nn.Module):
    def __init__(self, vocabulary, width=192):
        super().__init__()
        self.words = nn.Embedding(vocabulary, width)
        self.pose = nn.Linear(195, width)
        self.video_encoder = nn.GRU(width, width, batch_first=True)
        self.text_encoder = nn.GRU(width, width, batch_first=True)
        self.reader = nn.GRU(width * 2, width, batch_first=True)
        self.writer = nn.GRU(width * 2, width, batch_first=True)
        self.logits = nn.Linear(width, vocabulary)
        self.coordinates = nn.Linear(width, 195)
        self.stop = nn.Linear(width, 1)

    def context(self, memory, state):
        weights = torch.softmax(memory @ state.transpose(0, 1).transpose(1, 2) / memory.size(-1)**0.5, dim=1)
        return (memory * weights).sum(dim=1, keepdim=True)

    def read(self, poses, target=None):
        memory, state = self.video_encoder(self.pose(poses))
        token = torch.ones((1, 1), device=poses.device, dtype=torch.long)
        output = []
        for i in range(target.size(1) if target is not None else 80):
            inp = torch.cat([self.words(token), self.context(memory, state)], -1)
            value, state = self.reader(inp, state)
            logits = self.logits(value)
            output.append(logits)
            token = target[:, i:i+1] if target is not None else logits.argmax(-1)
            if target is None and token.item() == 2:
                break
        return torch.cat(output, 1)

    def sign(self, text, target=None):
        memory, state = self.text_encoder(self.words(text))
        previous = memory.new_zeros(1, 1, 195)
        frames, stops = [], []
        for i in range(target.size(1) if target is not None else 360):
            inp = torch.cat([self.pose(previous), self.context(memory, state)], -1)
            value, state = self.writer(inp, state)
            previous, stop = self.coordinates(value), self.stop(value)
            frames.append(previous)
            stops.append(stop)
            if target is not None:
                previous = target[:, i:i+1]
            elif i >= 3 and stop.sigmoid().item() > 0.5:
                break
        return torch.cat(frames, 1), torch.cat(stops, 1)
