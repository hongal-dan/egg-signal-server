import { Injectable } from '@nestjs/common'
import { OpenVidu, Session } from 'openvidu-node-client'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class SessionService {
  private openVidu: OpenVidu
  private sessions: Record<
    string,
    {
      session: Session
      participants: {
        name: string
        socketId: string
      }[]
    }
  > = {}

  constructor() {
    const OPENVIDU_URL = process.env.OPENVIDU_URL
    const OPENVIDU_SECRET = process.env.OPENVIDU_SECRET
    this.openVidu = new OpenVidu(OPENVIDU_URL, OPENVIDU_SECRET)
  }

  generateSessionId(): string {
    return uuidv4()
  }

  async createSession(sessionId: string): Promise<Session> {
    try {
      if (!this.sessions[sessionId]) {
        const session = await this.openVidu.createSession({
          customSessionId: sessionId,
        })
        this.sessions[sessionId] = { session, participants: [] }
        return session
      } else {
        return this.sessions[sessionId].session
      }
    } catch (error) {
      console.error(`Error creating session ${sessionId}:`, error)
      throw error // 예외를 호출하는 쪽으로 다시 던짐
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      if (this.sessions[sessionId]) {
        await this.sessions[sessionId].session.close()
        delete this.sessions[sessionId]
      }
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error)
      throw error // 예외를 호출하는 쪽으로 다시 던짐
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions[sessionId]?.session
  }

  getSessions(): Record<string, any> {
    return this.sessions
  }

  addParticipant(
    sessionId: string,
    participantName: string,
    socketId: string,
  ): void {
    try {
      if (this.sessions[sessionId]) {
        this.sessions[sessionId].participants.push({
          name: participantName,
          socketId: socketId,
        })
      } else {
        console.error(`Session ${sessionId} does not exist`)
        throw new Error(`Session ${sessionId} does not exist`)
      }
    } catch (error) {
      console.error(`Error adding participant to session ${sessionId}:`, error)
      throw error // 예외를 호출하는 쪽으로 다시 던짐
    }
  }

  removeParticipant(sessionId: string, participantName: string): void {
    try {
      if (this.sessions[sessionId]) {
        this.sessions[sessionId].participants = this.sessions[
          sessionId
        ].participants.filter(p => p.name !== participantName)
      } else {
        console.error(`Session ${sessionId} does not exist`)
        throw new Error(`Session ${sessionId} does not exist`)
      }
    } catch (error) {
      console.error(
        `Error removing participant from session ${sessionId}:`,
        error,
      )
      throw error // 예외를 호출하는 쪽으로 다시 던짐
    }
  }

  getParticipants(sessionId: string): { name: string; socketId: string }[] {
    return this.sessions[sessionId]?.participants || []
  }
}
