from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class GamePhase(str, Enum):
    WAITING = "WAITING"
    PREFLOP = "PREFLOP"
    FLOP = "FLOP"
    TURN = "TURN"
    RIVER = "RIVER"
    SHOWDOWN = "SHOWDOWN"
    COMPLETE = "COMPLETE"


class PlayerAction(str, Enum):
    FOLD = "fold"
    CALL = "call"
    RAISE = "raise"


class NewGameRequest(BaseModel):
    userId: str


class ActionRequest(BaseModel):
    userId: str
    action: PlayerAction
    amount: int | None = None


class ShowdownRequest(BaseModel):
    userId: str


class HandHistoryEntry(BaseModel):
    actor: Literal["user", "dn", "system"]
    action: str
    amount: int = 0
    state: GamePhase
    street: int
    pot: int
    note: str | None = None


class TerminalHand(BaseModel):
    reason: Literal["fold", "showdown"]
    winner: Literal["user", "dn", "split"]
    potAwarded: dict[Literal["user", "dn"], int]
    userHand: list[str]
    dnHand: list[str]
    board: list[str]
    userRank: str | None = None
    dnRank: str | None = None


class GameState(BaseModel):
    handId: str
    userId: str
    state: GamePhase = GamePhase.WAITING
    street: int = 0
    deck: list[str] = Field(default_factory=list)
    userHand: list[str] = Field(default_factory=list)
    dnHand: list[str] = Field(default_factory=list)
    board: list[str] = Field(default_factory=list)
    pot: int = 0
    sidePots: list[Any] = Field(default_factory=list)
    userStack: int = 0
    dnStack: int = 0
    userBet: int = 0
    dnBet: int = 0
    smallBlind: int = 25
    bigBlind: int = 50
    actionOn: Literal["user", "dn"] | None = None
    lastAction: str | None = None
    handHistory: list[HandHistoryEntry] = Field(default_factory=list)
    isAllIn: bool = False
    currentBet: int = 0
    lastRaiseSize: int = 50
    actedThisStreet: list[str] = Field(default_factory=list)
    winner: Literal["user", "dn", "split"] | None = None
    showdown: dict[str, Any] | None = None
    terminal: TerminalHand | None = None


class PublicGameState(BaseModel):
    handId: str
    userId: str
    state: GamePhase = GamePhase.WAITING
    street: int = 0
    userHand: list[str] = Field(default_factory=list)
    dnHand: list[str] = Field(default_factory=list)
    board: list[str] = Field(default_factory=list)
    pot: int = 0
    sidePots: list[Any] = Field(default_factory=list)
    userStack: int = 0
    dnStack: int = 0
    userBet: int = 0
    dnBet: int = 0
    smallBlind: int = 25
    bigBlind: int = 50
    actionOn: Literal["user", "dn"] | None = None
    lastAction: str | None = None
    handHistory: list[HandHistoryEntry] = Field(default_factory=list)
    isAllIn: bool = False
    currentBet: int = 0
    lastRaiseSize: int = 50
    actedThisStreet: list[str] = Field(default_factory=list)
    winner: Literal["user", "dn", "split"] | None = None
    showdown: dict[str, Any] | None = None
    terminal: TerminalHand | None = None


class ShowdownResult(BaseModel):
    winner: Literal["user", "dn", "split"]
    userScore: int
    dnScore: int
    userRank: str
    dnRank: str
    potAwarded: dict[str, int]
    isSplit: bool
    gameState: PublicGameState
